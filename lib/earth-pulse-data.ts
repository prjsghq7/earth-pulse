export type CollectionState = 'fresh' | 'delayed' | 'unreadable';

export interface EarthPulseEvent {
  id: string;
  magnitude: number;
  magnitudeType: string | null;
  place: string;
  timeUtc: string;
  dateKst: string;
  timeKst: string;
  updatedUtc: string;
  longitude: number;
  latitude: number;
  depthKm: number | null;
  status: string;
  tsunami: boolean;
  alert: string | null;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  significance: number | null;
  network: string | null;
  code: string | null;
  url: string | null;
  detailUrl: string | null;
  stationCount?: number | null;
  azimuthalGap?: number | null;
  rmsSeconds?: number | null;
}

export interface DailyRecord {
  dateKst: string;
  state: 'provisional' | 'final';
  count: number;
  maxMagnitude: number | null;
  averageMagnitude: number | null;
  medianMagnitude: number | null;
  medianDepthKm: number | null;
  eventIds: string[];
}

export interface CollectionStatus {
  schemaVersion: number;
  state: CollectionState;
  timezone: 'Asia/Seoul';
  targetDateKst: string;
  minMagnitude: number;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  dataThrough: string | null;
  nextScheduledAt: string;
  source: {
    name: string;
    endpoint: string;
    queryUrl: string;
    generatedAt?: string;
    featureCount?: number;
    acceptedCount?: number;
    rejectedCount?: number;
  };
  error: { code: string; message: string } | null;
}

interface EventFile {
  events: EarthPulseEvent[];
}

interface DailyFile {
  records: DailyRecord[];
}

export interface EarthPulseIndexEvent {
  id: string;
  dateKst: string;
  timeUtc: string;
  magnitude: number;
  magnitudeType: string | null;
  place: string;
  depthKm: number | null;
  longitude: number;
  latitude: number;
  status: string;
  tsunami: boolean;
  updatedUtc: string;
}

interface IndexFile {
  events: EarthPulseIndexEvent[];
}

export interface TodayBoardData {
  status: CollectionStatus;
  todayEvents: EarthPulseEvent[];
  recentDays: DailyRecord[];
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Earth Pulse data request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function yearsBetween(startDate: string, endDate: string) {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => String(startYear + index));
}

export async function loadEarthquakeIndex(startDate: string, endDate: string): Promise<EarthPulseIndexEvent[]> {
  const years = yearsBetween(startDate, endDate);
  const files = await Promise.all(years.map((year) => fetchJson<IndexFile>(`index/${year}.json`)));
  return files
    .flatMap((file) => file.events)
    .filter((event) => event.dateKst >= startDate && event.dateKst <= endDate);
}

export async function loadEvent(month: string, eventId: string): Promise<EarthPulseEvent | null> {
  const file = await fetchJson<EventFile>(`events/${month}.json`);
  return file.events.find((event) => event.id === eventId) ?? null;
}

export async function loadTodayBoard(): Promise<TodayBoardData> {
  const status = await fetchJson<CollectionStatus>('status.json');
  const dates = Array.from({ length: 8 }, (_, index) => addDays(status.targetDateKst, index - 7));
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
  const dailyFiles = await Promise.all(months.map((month) => fetchJson<DailyFile>(`daily/${month}.json`)));
  const currentMonth = status.targetDateKst.slice(0, 7);
  const eventsFile = await fetchJson<EventFile>(`events/${currentMonth}.json`);
  const dateSet = new Set(dates);

  return {
    status,
    todayEvents: eventsFile.events
      .filter((event) => event.dateKst === status.targetDateKst)
      .sort((a, b) => b.timeUtc.localeCompare(a.timeUtc)),
    recentDays: dailyFiles
      .flatMap((file) => file.records)
      .filter((record) => dateSet.has(record.dateKst))
      .sort((a, b) => a.dateKst.localeCompare(b.dateKst)),
  };
}
