import assert from 'node:assert/strict';

// Synthetic values only. This checks the public data contract without
// placing test records in public/data or exposing them in the service UI.
const previous = {
  state: 'fresh',
  lastSuccessAt: '2026-09-02T12:10:00.000Z',
  dataThrough: '2026-09-02T12:10:00.000Z',
  error: null,
};

const scenarios = [
  ['source_timeout', '느린 외부 응답'],
  ['source_rejected', '외부 원천 403 거절'],
  ['rate_limited', '외부 원천 호출 제한'],
  ['source_offline', '네트워크 오프라인'],
  ['format_mismatch', '응답 형식 불일치'],
];

function afterFailure(before, code) {
  return {
    state: before.lastSuccessAt ? 'delayed' : 'unreadable',
    lastSuccessAt: before.lastSuccessAt,
    dataThrough: before.dataThrough,
    error: { code },
  };
}

function afterRecovery(before, existingDailyRecords, targetDateKst) {
  const records = existingDailyRecords.some((record) => record.dateKst === targetDateKst)
    ? existingDailyRecords
    : [...existingDailyRecords, { dateKst: targetDateKst, state: 'provisional', count: 2 }];
  return {
    state: 'fresh',
    lastSuccessAt: '2026-09-03T12:10:00.000Z',
    dataThrough: '2026-09-03T12:10:00.000Z',
    error: null,
    records,
  };
}

const results = scenarios.map(([code, label]) => {
  const delayed = afterFailure(previous, code);
  assert.equal(delayed.state, 'delayed', `${code}: stale status was not applied`);
  assert.equal(delayed.error.code, code, `${code}: error type was lost`);
  assert.equal(delayed.lastSuccessAt, previous.lastSuccessAt, `${code}: last normal value was erased`);
  assert.equal(delayed.dataThrough, previous.dataThrough, `${code}: stale data boundary was erased`);

  const recovered = afterRecovery(delayed, [{ dateKst: '2026-09-02', state: 'final', count: 19 }], '2026-09-03');
  const rerun = afterRecovery(recovered, recovered.records, '2026-09-03');
  assert.equal(recovered.state, 'fresh', `${code}: recovery did not return fresh`);
  assert.equal(recovered.error, null, `${code}: recovery did not clear the error code`);
  assert.equal(recovered.records.filter((record) => record.dateKst === '2026-09-03').length, 1, `${code}: recovery did not add one daily record`);
  assert.equal(rerun.records.filter((record) => record.dateKst === '2026-09-03').length, 1, `${code}: same-day recovery duplicated a record`);
  return { code, label, preservedLastNormal: true, recovered: true };
});

console.log(JSON.stringify({
  fixtureType: 'synthetic-only',
  scenarioCount: results.length,
  results,
}, null, 2));
