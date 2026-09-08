const QUALITY_FIELDS = ['stationCount', 'azimuthalGap', 'rmsSeconds'];

// Null is a valid upstream answer. Recheck missing quality at most once a day.
export function canReuseQuality(event, cached, now) {
  if (!cached || cached.updatedUtc !== event.updatedUtc) return false;
  if (QUALITY_FIELDS.every((key) => Number.isFinite(cached[key]))) return true;
  const checked = Date.parse(cached.qualityCheckedAt ?? '');
  return Number.isFinite(checked) && now.getTime() - checked < 86_400_000;
}

export function reuseQuality(event, cached) {
  return { ...event, ...Object.fromEntries(QUALITY_FIELDS.map((key) => [key, cached[key] ?? null])), qualityCheckedAt: cached.qualityCheckedAt };
}
