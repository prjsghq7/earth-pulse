import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, 'public', 'data');
const TIME_ZONE = 'Asia/Seoul';
const MIN_MAGNITUDE = 4;
const SCHEMA_VERSION = 1;
const MAX_PENDING_FINALIZATION_DAYS = 7;
const API_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
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

function nextScheduledAt(now) {
  const today = kstDate(now);
  for (const hour of [0, 3, 6, 9, 12, 15, 18, 21]) {
    const candidate = new Date(`${today}T${String(hour).padStart(2, '0')}:10:00+09:00`);
    if (candidate > now) return candidate.toISOString();
  }
  return new Date(`${addDays(today, 1)}T00:10:00+09:00`).toISOString();
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
    if (!current || event.updatedUtc > current.updatedUtc) merged.set(event.id, event);
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

function dailySummary(date, events, today) {
  const dailyEvents = events.filter((event) => event.dateKst === date);
  const magnitudes = dailyEvents.map((event) => event.magnitude);
  const depths = dailyEvents.map((event) => event.depthKm).filter((value) => value !== null);
  return {
    dateKst: date,
    state: date === today ? 'provisional' : 'final',
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
    month: event.dateKst.slice(0, 7),
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

async function pendingFinalizationDates(today) {
  const pending = [];
  for (let offset = 1; offset <= MAX_PENDING_FINALIZATION_DAYS; offset += 1) {
    const date = addDays(today, -offset);
    const daily = await readJson(path.join(DATA_ROOT, 'daily', `${date.slice(0, 7)}.json`), { records: [] });
    const record = (daily.records ?? []).find((item) => item.dateKst === date);
    if (record?.state === 'final') break;
    pending.push(date);
  }
  return pending.reverse();
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await rename(temporary, file);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
    await rm(file, { force: true });
    await rename(temporary, file);
  }
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

function classifyError(error) {
  const status = error?.status;
  if (status === 401 || status === 403) return 'source_rejected';
  if (status === 429) return 'rate_limited';
  if (error?.name === 'AbortError') return 'source_timeout';
  if (error instanceof SyntaxError) return 'format_mismatch';
  return 'source_offline';
}

async function fetchGeoJson(queryUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(queryUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'Earth-Pulse/0.1' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`USGS responded with HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const json = await response.json();
    if (!Array.isArray(json?.features) || typeof json?.metadata?.generated !== 'number') {
      throw new SyntaxError('USGS GeoJSON schema did not match the expected response');
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function writeManifest(collectedAt) {
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
    dataVersion: collectedAt,
    generatedAt: collectedAt,
    files,
  });
}

async function collect() {
  const now = new Date();
  const collectedAt = now.toISOString();
  const today = kstDate(now);
  // A daily record is an immutable KST snapshot after it becomes final.
  // Only today's provisional record is refreshed. If a previous day could not
  // be finalized because a collection failed, it remains pending and is retried.
  const pendingDates = await pendingFinalizationDates(today);
  const datesToWrite = [...pendingDates, today];
  const startDate = pendingDates[0] ?? today;
  const startUtc = new Date(`${startDate}T00:00:00+09:00`).toISOString();
  const endUtc = now.toISOString();
  const query = new URL(API_ENDPOINT);
  query.search = new URLSearchParams({
    format: 'geojson',
    starttime: startUtc,
    endtime: endUtc,
    minmagnitude: String(MIN_MAGNITUDE),
    eventtype: 'earthquake',
    orderby: 'time-asc',
    limit: '20000',
  }).toString();

  const previousStatus = await readJson(path.join(DATA_ROOT, 'status.json'), null);
  try {
    const raw = await fetchGeoJson(query.toString());
    const normalized = raw.features.map(normalizeFeature).filter(Boolean);
    const rejectedCount = raw.features.length - normalized.length;
    const months = [...new Set([...normalized.map((event) => event.dateKst.slice(0, 7)), ...datesToWrite.map((date) => date.slice(0, 7))])];
    const mergedByMonth = new Map();

    for (const month of months) {
      const file = path.join(DATA_ROOT, 'events', `${month}.json`);
      const existing = await readJson(file, { events: [] });
      const incoming = normalized.filter((event) => event.dateKst.startsWith(month));
      const events = mergeEvents(existing.events ?? [], incoming);
      mergedByMonth.set(month, events);
      await atomicJson(file, { schemaVersion: SCHEMA_VERSION, month, timezone: TIME_ZONE, minMagnitude: MIN_MAGNITUDE, events });
    }

    const allAffectedEvents = [...mergedByMonth.values()].flat();
    for (const month of new Set(datesToWrite.map((date) => date.slice(0, 7)))) {
      const file = path.join(DATA_ROOT, 'daily', `${month}.json`);
      const existing = await readJson(file, { records: [] });
      const replacementDates = new Set(datesToWrite.filter((date) => date.startsWith(month)));
      const records = [
        ...(existing.records ?? []).filter((record) => !replacementDates.has(record.dateKst)),
        ...[...replacementDates].map((date) => dailySummary(date, allAffectedEvents, today)),
      ].sort((a, b) => a.dateKst.localeCompare(b.dateKst));
      await atomicJson(file, { schemaVersion: SCHEMA_VERSION, month, timezone: TIME_ZONE, minMagnitude: MIN_MAGNITUDE, records });
    }

    for (const year of new Set(normalized.map((event) => event.dateKst.slice(0, 4)))) {
      const file = path.join(DATA_ROOT, 'index', `${year}.json`);
      const existing = await readJson(file, { events: [] });
      const incoming = normalized.filter((event) => event.dateKst.startsWith(year)).map(indexEvent);
      const events = mergeEvents(existing.events ?? [], incoming).sort(byTimeAscending);
      await atomicJson(file, { schemaVersion: SCHEMA_VERSION, year, timezone: TIME_ZONE, minMagnitude: MIN_MAGNITUDE, events });
    }

    const sourceGeneratedAt = new Date(raw.metadata.generated).toISOString();
    await atomicJson(path.join(DATA_ROOT, 'status.json'), {
      schemaVersion: SCHEMA_VERSION,
      state: 'fresh',
      timezone: TIME_ZONE,
      targetDateKst: today,
      minMagnitude: MIN_MAGNITUDE,
      lastAttemptAt: collectedAt,
      lastSuccessAt: collectedAt,
      dataThrough: endUtc,
      nextScheduledAt: nextScheduledAt(now),
      source: {
        name: 'USGS ComCat FDSN Event API',
        endpoint: API_ENDPOINT,
        queryUrl: query.toString(),
        generatedAt: sourceGeneratedAt,
        featureCount: raw.features.length,
        acceptedCount: normalized.length,
        rejectedCount,
      },
      error: null,
    });
    await writeManifest(collectedAt);
    console.log(JSON.stringify({ state: 'fresh', today, finalizedDates: pendingDates, range: { startUtc, endUtc }, fetched: raw.features.length, accepted: normalized.length, rejected: rejectedCount, months }, null, 2));
  } catch (error) {
    await atomicJson(path.join(DATA_ROOT, 'status.json'), {
      schemaVersion: SCHEMA_VERSION,
      state: previousStatus?.lastSuccessAt ? 'delayed' : 'unreadable',
      timezone: TIME_ZONE,
      targetDateKst: today,
      minMagnitude: MIN_MAGNITUDE,
      lastAttemptAt: collectedAt,
      lastSuccessAt: previousStatus?.lastSuccessAt ?? null,
      dataThrough: previousStatus?.dataThrough ?? null,
      nextScheduledAt: nextScheduledAt(now),
      source: previousStatus?.source ?? { name: 'USGS ComCat FDSN Event API', endpoint: API_ENDPOINT, queryUrl: query.toString() },
      error: { code: classifyError(error), message: '외부 지진 자료를 갱신하지 못했습니다. 저장된 마지막 정상값을 유지합니다.' },
    });
    throw error;
  }
}

await mkdir(DATA_ROOT, { recursive: true });
await collect();
