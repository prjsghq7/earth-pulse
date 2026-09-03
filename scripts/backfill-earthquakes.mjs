import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, 'public', 'data');
const PROGRESS_FILE = path.join(DATA_ROOT, 'backfill-status.json');
const TIME_ZONE = 'Asia/Seoul';
const MIN_MAGNITUDE = 4;
const SCHEMA_VERSION = 1;
const QUERY_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const DEFAULT_START_MONTH = '1900-01';
const REQUEST_DELAY_MS = 300;

function argValue(name, fallback = null) {
  const match = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
}

function hasArg(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function assertMonth(value, name) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error(`--${name} must use YYYY-MM`);
  return value;
}

function addMonths(month, amount) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function kstMonth(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(value);
}

function kstParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function kstDate(value) {
  const parts = kstParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function kstTime(value) {
  const parts = kstParts(value);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function monthsBetween(startMonth, endMonth) {
  const months = [];
  for (let month = startMonth; month <= endMonth; month = addMonths(month, 1)) months.push(month);
  return months;
}

function daysInMonth(month) {
  const end = `${addMonths(month, 1)}-01`;
  const dates = [];
  for (let date = `${month}-01`; date < end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeFeature(feature) {
  const properties = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  const magnitude = finiteNumber(properties?.mag);
  const time = finiteNumber(properties?.time);
  const updated = finiteNumber(properties?.updated);
  const longitude = finiteNumber(coordinates?.[0]);
  const latitude = finiteNumber(coordinates?.[1]);
  const depthKm = finiteNumber(coordinates?.[2]);

  if (
    typeof feature?.id !== 'string' ||
    properties?.type !== 'earthquake' ||
    magnitude === null || magnitude < MIN_MAGNITUDE ||
    time === null || updated === null ||
    longitude === null || latitude === null
  ) return null;

  const origin = new Date(time);
  return {
    id: feature.id,
    magnitude,
    magnitudeType: typeof properties.magType === 'string' ? properties.magType : null,
    place: typeof properties.place === 'string' ? properties.place : '위치 정보 없음',
    timeUtc: origin.toISOString(),
    dateKst: kstDate(origin),
    timeKst: kstTime(origin),
    updatedUtc: new Date(updated).toISOString(),
    longitude,
    latitude,
    depthKm,
    status: typeof properties.status === 'string' ? properties.status : 'unknown',
    tsunami: properties.tsunami === 1,
    alert: typeof properties.alert === 'string' ? properties.alert : null,
    felt: finiteNumber(properties.felt),
    cdi: finiteNumber(properties.cdi),
    mmi: finiteNumber(properties.mmi),
    significance: finiteNumber(properties.sig),
    network: typeof properties.net === 'string' ? properties.net : null,
    code: typeof properties.code === 'string' ? properties.code : null,
    url: typeof properties.url === 'string' ? properties.url : null,
    detailUrl: typeof properties.detail === 'string' ? properties.detail : null,
  };
}

function byTimeAscending(a, b) {
  return a.timeUtc.localeCompare(b.timeUtc) || a.id.localeCompare(b.id);
}

function mergeEvents(existing, incoming) {
  const merged = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) {
    const current = merged.get(event.id);
    if (!current || (event.updatedUtc ?? '') > (current.updatedUtc ?? '')) merged.set(event.id, event);
  }
  return [...merged.values()].sort(byTimeAscending);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value, digits = 2) {
  return value === null ? null : Number(value.toFixed(digits));
}

function dailySummary(date, events) {
  const dailyEvents = events.filter((event) => event.dateKst === date);
  const magnitudes = dailyEvents.map((event) => event.magnitude);
  const depths = dailyEvents.map((event) => event.depthKm).filter((value) => value !== null);
  return {
    dateKst: date,
    state: 'final',
    count: dailyEvents.length,
    maxMagnitude: magnitudes.length ? Math.max(...magnitudes) : null,
    averageMagnitude: magnitudes.length ? round(magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length) : null,
    medianMagnitude: round(median(magnitudes)),
    medianDepthKm: round(median(depths), 1),
    eventIds: dailyEvents.map((event) => event.id),
  };
}

function indexEvent(event) {
  return {
    id: event.id,
    dateKst: event.dateKst,
    timeUtc: event.timeUtc,
    magnitude: event.magnitude,
    magnitudeType: event.magnitudeType,
    place: event.place,
    depthKm: event.depthKm,
    longitude: event.longitude,
    latitude: event.latitude,
    status: event.status,
    tsunami: event.tsunami,
    updatedUtc: event.updatedUtc,
  };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, 'utf8');
  try {
    await rename(temporary, file);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
    await rm(file, { force: true });
    await rename(temporary, file);
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchGeoJson(queryUrl, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(queryUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'Earth-Pulse/0.1 (historical backfill)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`USGS HTTP ${response.status}: ${body.slice(0, 240)}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    const json = await response.json();
    if (!Array.isArray(json?.features) || typeof json?.metadata?.generated !== 'number') {
      throw new SyntaxError('USGS GeoJSON schema did not match the expected response');
    }
    return json;
  } catch (error) {
    if (attempt < 3 && (error?.name === 'AbortError' || error?.status === 429 || error?.status >= 500)) {
      await sleep(1000 * (3 ** (attempt - 1)));
      return fetchGeoJson(queryUrl, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function queryUrl(startUtc, endUtc) {
  const url = new URL(QUERY_ENDPOINT);
  url.search = new URLSearchParams({
    format: 'geojson',
    starttime: startUtc,
    endtime: endUtc,
    minmagnitude: String(MIN_MAGNITUDE),
    eventtype: 'earthquake',
    orderby: 'time-asc',
    limit: '20000',
  }).toString();
  return url.toString();
}

function midpoint(startUtc, endUtc) {
  const start = new Date(startUtc).getTime();
  const end = new Date(endUtc).getTime();
  return new Date(start + Math.floor((end - start) / 2)).toISOString();
}

async function fetchRange(startUtc, endUtc, depth = 0) {
  const url = queryUrl(startUtc, endUtc);
  try {
    const raw = await fetchGeoJson(url);
    if (raw.features.length < 20_000) return { features: raw.features, queryUrls: [url], generated: raw.metadata.generated };
  } catch (error) {
    const tooMany = error?.status === 400 && /20,?000|too many|maximum/i.test(error?.body ?? error.message);
    if (!tooMany || depth >= 12) throw error;
  }

  if (depth >= 12) throw new Error(`Unable to split an oversized USGS interval: ${startUtc} - ${endUtc}`);
  const middle = midpoint(startUtc, endUtc);
  const left = await fetchRange(startUtc, middle, depth + 1);
  await sleep(REQUEST_DELAY_MS);
  const right = await fetchRange(middle, endUtc, depth + 1);
  return {
    features: [...left.features, ...right.features],
    queryUrls: [...left.queryUrls, ...right.queryUrls],
    generated: Math.max(left.generated, right.generated),
  };
}

async function dataFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await dataFiles(fullPath));
    else if (entry.name.endsWith('.json') && entry.name !== 'manifest.json') results.push(fullPath);
  }
  return results;
}

async function writeManifest(generatedAt) {
  const files = [];
  for (const file of (await dataFiles(DATA_ROOT)).sort()) {
    const contents = await readFile(file);
    const parsed = JSON.parse(contents.toString('utf8'));
    const relativePath = path.relative(DATA_ROOT, file).replaceAll(path.sep, '/');
    files.push({
      path: relativePath,
      sha256: createHash('sha256').update(contents).digest('hex'),
      bytes: (await stat(file)).size,
      recordCount: Array.isArray(parsed.events) ? parsed.events.length : Array.isArray(parsed.records) ? parsed.records.length : 1,
    });
  }
  await atomicJson(path.join(DATA_ROOT, 'manifest.json'), {
    schemaVersion: SCHEMA_VERSION,
    dataVersion: generatedAt,
    generatedAt,
    files,
  });
}

async function saveMonth(month, fetched, retrievedAt) {
  const detailFile = path.join(DATA_ROOT, 'events', `${month}.json`);
  const existingDetails = await readJson(detailFile, { events: [] });
  const incoming = fetched.features.map(normalizeFeature).filter(Boolean).filter((event) => event.dateKst.startsWith(month));
  const events = mergeEvents(existingDetails.events ?? [], incoming);

  await atomicJson(detailFile, {
    schemaVersion: SCHEMA_VERSION,
    month,
    timezone: TIME_ZONE,
    minMagnitude: MIN_MAGNITUDE,
    source: {
      name: 'USGS ComCat FDSN Event API',
      endpoint: QUERY_ENDPOINT,
      retrievedAt,
      generatedAt: new Date(fetched.generated).toISOString(),
      queryUrls: fetched.queryUrls,
    },
    events,
  });

  const dailyFile = path.join(DATA_ROOT, 'daily', `${month}.json`);
  await atomicJson(dailyFile, {
    schemaVersion: SCHEMA_VERSION,
    month,
    timezone: TIME_ZONE,
    minMagnitude: MIN_MAGNITUDE,
    collectionMode: 'historical-backfill',
    records: daysInMonth(month).map((date) => dailySummary(date, events)),
  });

  const year = month.slice(0, 4);
  const indexFile = path.join(DATA_ROOT, 'index', `${year}.json`);
  const existingIndex = await readJson(indexFile, { events: [] });
  const monthIds = new Set(events.map((event) => event.id));
  const retained = (existingIndex.events ?? []).filter((event) => !event.dateKst.startsWith(month) && !monthIds.has(event.id));
  const indexed = [...retained, ...events.map(indexEvent)].sort(byTimeAscending);
  await atomicJson(indexFile, {
    schemaVersion: SCHEMA_VERSION,
    year,
    timezone: TIME_ZONE,
    minMagnitude: MIN_MAGNITUDE,
    events: indexed,
  });

  return { fetched: fetched.features.length, accepted: incoming.length, stored: events.length };
}

async function backfill() {
  const defaultEndMonth = addMonths(kstMonth(), -1);
  const startMonth = assertMonth(argValue('start', DEFAULT_START_MONTH), 'start');
  const endMonth = assertMonth(argValue('end', defaultEndMonth), 'end');
  if (startMonth > endMonth) throw new Error('--start must not be after --end');

  const maxMonthsRaw = argValue('max-months');
  const maxMonths = maxMonthsRaw === null ? Number.POSITIVE_INFINITY : Number.parseInt(maxMonthsRaw, 10);
  if (!(maxMonths > 0)) throw new Error('--max-months must be a positive integer');

  const force = hasArg('force');
  const previous = await readJson(PROGRESS_FILE, { completedMonths: [], failures: [] });
  const completed = new Set(previous.completedMonths ?? []);
  const requested = monthsBetween(startMonth, endMonth);
  const pending = requested.filter((month) => force || !completed.has(month)).slice(0, maxMonths);
  const startedAt = new Date().toISOString();
  let totalStored = 0;

  console.log(JSON.stringify({ state: 'starting', startMonth, endMonth, requested: requested.length, alreadyCompleted: requested.length - pending.length, thisRun: pending.length }, null, 2));

  for (const [index, month] of pending.entries()) {
    const intervalStart = new Date(`${month}-01T00:00:00+09:00`).toISOString();
    const intervalEnd = new Date(`${addMonths(month, 1)}-01T00:00:00+09:00`).toISOString();
    const retrievedAt = new Date().toISOString();
    try {
      const fetched = await fetchRange(intervalStart, intervalEnd);
      const result = await saveMonth(month, fetched, retrievedAt);
      totalStored += result.stored;
      completed.add(month);
      const progress = {
        schemaVersion: SCHEMA_VERSION,
        state: 'running',
        timezone: TIME_ZONE,
        minMagnitude: MIN_MAGNITUDE,
        requestedRange: { startMonth, endMonth },
        startedAt,
        updatedAt: new Date().toISOString(),
        lastCompletedMonth: month,
        completedMonths: [...completed].sort((a, b) => a.localeCompare(b)),
        failures: (previous.failures ?? []).filter((failure) => failure.month !== month),
      };
      await atomicJson(PROGRESS_FILE, progress);
      console.log(`[${index + 1}/${pending.length}] ${month}: fetched=${result.fetched}, accepted=${result.accepted}, stored=${result.stored}`);
      if (index < pending.length - 1) await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      const failures = [
        ...(previous.failures ?? []).filter((failure) => failure.month !== month),
        { month, at: new Date().toISOString(), message: error.message },
      ];
      await atomicJson(PROGRESS_FILE, {
        schemaVersion: SCHEMA_VERSION,
        state: 'delayed',
        timezone: TIME_ZONE,
        minMagnitude: MIN_MAGNITUDE,
        requestedRange: { startMonth, endMonth },
        startedAt,
        updatedAt: new Date().toISOString(),
        lastCompletedMonth: [...completed].sort((a, b) => a.localeCompare(b)).at(-1) ?? null,
        completedMonths: [...completed].sort((a, b) => a.localeCompare(b)),
        failures,
      });
      await writeManifest(new Date().toISOString());
      throw error;
    }
  }

  const remaining = requested.filter((month) => !completed.has(month));
  const finishedAt = new Date().toISOString();
  await atomicJson(PROGRESS_FILE, {
    schemaVersion: SCHEMA_VERSION,
    state: remaining.length ? 'paused' : 'complete',
    timezone: TIME_ZONE,
    minMagnitude: MIN_MAGNITUDE,
    requestedRange: { startMonth, endMonth },
    startedAt,
    updatedAt: finishedAt,
    lastCompletedMonth: [...completed].sort((a, b) => a.localeCompare(b)).at(-1) ?? null,
    completedMonths: [...completed].sort((a, b) => a.localeCompare(b)),
    remainingMonths: remaining.length,
    failures: previous.failures ?? [],
  });
  await writeManifest(finishedAt);
  console.log(JSON.stringify({ state: remaining.length ? 'paused' : 'complete', completedThisRun: pending.length, remaining: remaining.length, totalStored }, null, 2));
}

await mkdir(DATA_ROOT, { recursive: true });
await backfill();
