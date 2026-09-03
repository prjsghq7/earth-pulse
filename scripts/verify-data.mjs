import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DATA_ROOT = path.join(process.cwd(), 'public', 'data');

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(DATA_ROOT, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = await json('manifest.json');
const status = await json('status.json');

for (const entry of manifest.files) {
  const contents = await readFile(path.join(DATA_ROOT, entry.path));
  const hash = createHash('sha256').update(contents).digest('hex');
  assert(hash === entry.sha256, `Hash mismatch: ${entry.path}`);
}

const eventDateById = new Map();
const eventCountByDate = new Map();
let detailEvents = 0;

for (const entry of manifest.files.filter((file) => file.path.startsWith('events/'))) {
  const parsed = await json(entry.path);
  const expectedMonth = entry.path.slice('events/'.length, -'.json'.length);
  for (const event of parsed.events) {
    assert(!eventDateById.has(event.id), `Duplicate detail event ID: ${event.id}`);
    assert(event.magnitude >= status.minMagnitude, `Event below minimum magnitude: ${event.id}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(event.dateKst), `Invalid KST date key: ${event.id}`);
    assert(event.dateKst.startsWith(expectedMonth), `Event stored in wrong month: ${event.id}`);
    eventDateById.set(event.id, event.dateKst);
    eventCountByDate.set(event.dateKst, (eventCountByDate.get(event.dateKst) ?? 0) + 1);
    detailEvents += 1;
  }
}

const dailyDates = new Set();
let dailyRecords = 0;
let currentRecord = null;

for (const entry of manifest.files.filter((file) => file.path.startsWith('daily/'))) {
  const parsed = await json(entry.path);
  const expectedMonth = entry.path.slice('daily/'.length, -'.json'.length);
  for (const record of parsed.records) {
    assert(!dailyDates.has(record.dateKst), `Duplicate daily record: ${record.dateKst}`);
    assert(record.dateKst.startsWith(expectedMonth), `Daily record stored in wrong month: ${record.dateKst}`);
    const expectedCount = eventCountByDate.get(record.dateKst) ?? 0;
    assert(record.count === expectedCount, `Daily count mismatch: ${record.dateKst}`);
    assert(record.eventIds.length === expectedCount, `Daily event ID count mismatch: ${record.dateKst}`);
    const recordIds = new Set(record.eventIds);
    assert(recordIds.size === record.eventIds.length, `Duplicate ID in daily record: ${record.dateKst}`);
    for (const id of record.eventIds) {
      assert(eventDateById.get(id) === record.dateKst, `Daily record contains an event from another date: ${id}`);
    }
    dailyDates.add(record.dateKst);
    dailyRecords += 1;
    if (record.dateKst === status.targetDateKst) currentRecord = record;
  }
}

for (const date of eventCountByDate.keys()) assert(dailyDates.has(date), `Missing daily record: ${date}`);

let indexEvents = 0;
for (const entry of manifest.files.filter((file) => file.path.startsWith('index/'))) {
  const parsed = await json(entry.path);
  const expectedYear = entry.path.slice('index/'.length, -'.json'.length);
  const yearIds = new Set();
  for (const event of parsed.events) {
    assert(!yearIds.has(event.id), `Duplicate ID in yearly index ${expectedYear}: ${event.id}`);
    assert(event.dateKst.startsWith(expectedYear), `Index event stored in wrong year: ${event.id}`);
    assert(eventDateById.get(event.id) === event.dateKst, `Index/detail mismatch: ${event.id}`);
    yearIds.add(event.id);
    indexEvents += 1;
  }
}

assert(indexEvents === detailEvents, `Index count ${indexEvents} does not match detail count ${detailEvents}`);
assert(currentRecord, `Missing current KST daily record: ${status.targetDateKst}`);
assert(currentRecord.state === 'provisional', 'Current KST day must remain provisional');

console.log(JSON.stringify({
  state: status.state,
  targetDateKst: status.targetDateKst,
  detailEvents,
  uniqueEventIds: eventDateById.size,
  indexEvents,
  dailyRecords,
  todayCount: currentRecord.count,
  hashesVerified: manifest.files.length,
}, null, 2));
