import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDR, periodRange, periodStatus, buildPlan } from '../src/promoPlan.js';

const T = new Date(2026, 9, 30);
const ymd = d => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

test('parseDR puts the written year on the END date', () => {
  const r = parseDR('23/12-5/01/27', T);
  assert.deepEqual(ymd(r.s), [2026, 12, 23]);
  assert.deepEqual(ymd(r.e), [2027, 1, 5]);
});
test('parseDR no-year range crossing new year', () => {
  const r = parseDR('27/12-9/01', T);
  assert.deepEqual(ymd(r.s), [2026, 12, 27]);
  assert.deepEqual(ymd(r.e), [2027, 1, 9]);
});
test('parseDR allows spaces around the dash', () => {
  const r = parseDR('26/06 - 30/07/26', T);
  assert.deepEqual(ymd(r.s), [2026, 6, 26]);
  assert.deepEqual(ymd(r.e), [2026, 7, 30]);
});
test('parseDR existing formats unchanged', () => {
  let r = parseDR('29.10.26 - 25.11.26', T);
  assert.deepEqual([ymd(r.s), ymd(r.e)], [[2026, 10, 29], [2026, 11, 25]]);
  r = parseDR('22/10/26 - 18/11/26', T);
  assert.deepEqual([ymd(r.s), ymd(r.e)], [[2026, 10, 22], [2026, 11, 18]]);
  r = parseDR('1-31/10/2569', T);
  assert.deepEqual([ymd(r.s), ymd(r.e)], [[2026, 10, 1], [2026, 10, 31]]);
});
test('periodRange 62-day guard counts whole days', () => {
  assert.notEqual(periodRange({ name: 'SP6', dateRange: '26/03-27/05/26' }, T), null);
  assert.equal(periodRange({ name: '2701/02', dateRange: '23/12/25-5/01/27' }, T), null);
});
test('periodRange falls back to the name', () => {
  const r = periodRange({ name: 'Oct', dateRange: '' }, T);
  assert.deepEqual([ymd(r.s), ymd(r.e)], [[2026, 10, 1], [2026, 10, 31]]);
  assert.equal(periodRange({ name: '2603/04', dateRange: '' }, T), null);
});
test('periodStatus', () => {
  assert.equal(periodStatus({ s: new Date(2026, 9, 1), e: new Date(2026, 10, 1) }, T), 'now');
  assert.equal(periodStatus({ s: new Date(2026, 8, 1), e: new Date(2026, 8, 30, 23, 59, 59, 999) }, T), 'past');
  assert.equal(periodStatus({ s: new Date(2026, 10, 1), e: new Date(2026, 10, 30) }, T), 'future');
  assert.equal(periodStatus(null, T), 'unknown');
});

test('buildPlan sorts by start date', () => {
  const p = buildPlan([
    { name: 'Oct', dateRange: '1-31/10/26' }, { name: 'Bro.10', dateRange: '25/09 -29/10/26' },
    { name: 'Bro.11', dateRange: '30/10- 26/11/26' }, { name: 'Nov', dateRange: '1-30/11/26' }], T);
  assert.deepEqual(p.cols.map(c => c.name), ['Bro.10', 'Oct', 'Bro.11', 'Nov']);
  const st = n => p.cols.find(c => c.name === n).status;
  assert.equal(st('Oct'), 'now');
  assert.equal(st('Bro.11'), 'now');
  assert.equal(p.hasNow, true);
});
test('buildPlan keeps source order when any period is undated', () => {
  const p = buildPlan([{ name: '2647/48', dateRange: '22/10/26 - 18/11/26' }, { name: '2603/04', dateRange: '' }], T);
  assert.deepEqual(p.cols.map(c => c.name), ['2647/48', '2603/04']);
  assert.equal(p.cols[1].status, 'unknown');
  assert.equal(p.hasUnknown, true);
});
test('buildPlan all past', () => {
  const p = buildPlan([{ name: 'a', dateRange: '1/01-14/01/23' }, { name: 'b', dateRange: '15/01-28/01/23' }], T);
  assert.deepEqual([p.hasNow, p.hasFuture, p.hasUnknown], [false, false, false]);
});
