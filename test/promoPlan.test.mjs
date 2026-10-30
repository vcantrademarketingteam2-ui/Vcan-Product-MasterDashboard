import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDR, periodRange, periodStatus, buildPlan, quarterSpan, monthSpan, colsInSpan, defaultPick, colsForPick, pickLabel, pickYears } from '../src/promoPlan.js';
import { productRows, bestNow } from '../src/promoPlan.js';

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

const tops = buildPlan([
  { name: '2641/42', dateRange: '30/09-13/10/26' }, { name: '2643/44', dateRange: '14/10-27/10/26' },
  { name: '2645/46', dateRange: '28/10-10/11/26' }, { name: '2647/48', dateRange: '11/11-24/11/26' },
  { name: '2701/02', dateRange: '23/12-5/01/27' }], T).cols;
const names = cs => cs.map(c => c.name);

test("defaultPick is today's month when something is live", () => {
  assert.deepEqual(defaultPick(tops, T), { lvl: 'm', y: 2026, q: 3, m: 9 });
});
test('colsForPick month / quarter / period', () => {
  assert.deepEqual(names(colsForPick(tops, { lvl: 'm', y: 2026, q: 3, m: 9 })), ['2641/42', '2643/44', '2645/46']);
  assert.equal(colsForPick(tops, { lvl: 'q', y: 2026, q: 3 }).length, 5);
  assert.deepEqual(names(colsForPick(tops, { lvl: 'p', name: '2647/48' })), ['2647/48']);
  assert.deepEqual(colsForPick(tops, null), []);
});
test('spans end at the last day 23:59:59.999', () => {
  const [qs, qe] = quarterSpan(2026, 3);
  assert.deepEqual([ymd(qs), ymd(qe)], [[2026, 10, 1], [2026, 12, 31]]);
  assert.equal(monthSpan(2026, 1)[1].getDate(), 28);
  assert.equal(colsInSpan(tops, monthSpan(2026, 10)).length, 2);
});
test('defaultPick all past -> month of last dated col', () => {
  const big = buildPlan([{ name: 'a', dateRange: '1/01-14/01/23' }, { name: 'b', dateRange: '15/03-28/03/23' }], T).cols;
  assert.deepEqual(defaultPick(big, T), { lvl: 'm', y: 2023, q: 0, m: 2 });
});
test('defaultPick future, undated and empty', () => {
  const fut = buildPlan([{ name: 'a', dateRange: '1/12-14/12/26' }], T).cols;
  assert.deepEqual(defaultPick(fut, T), { lvl: 'm', y: 2026, q: 3, m: 11 });
  const und = buildPlan([{ name: '2603/04', dateRange: '' }], T).cols;
  assert.deepEqual(defaultPick(und, T), { lvl: 'u' });
  assert.equal(defaultPick([], T), null);
  assert.deepEqual(names(colsForPick(und, { lvl: 'u' })), ['2603/04']);
});
test('pickLabel and pickYears', () => {
  assert.equal(pickLabel({ lvl: 'q', y: 2026, q: 3 }), 'Q4 2026');
  assert.equal(pickLabel({ lvl: 'm', y: 2026, q: 3, m: 9 }), 'Oct 2026');
  assert.equal(pickLabel({ lvl: 'p', name: '2647/48', y: 2026, m: 10 }), '2647/48 (Nov 2026)');
  assert.equal(pickLabel({ lvl: 'u' }), 'Undated periods');
  assert.equal(pickLabel(null), 'No periods');
  assert.deepEqual(pickYears(tops), [2026, 2027]);
});

const twd = buildPlan([
  { name: 'Oct', dateRange: '1-31/10/26' }, { name: 'Bro.10', dateRange: '25/09 -29/10/26' },
  { name: 'Bro.11', dateRange: '30/10- 26/11/26' }, { name: 'Nov', dateRange: '1-30/11/26' },
  { name: 'Dec', dateRange: '1-31/12/26' }, { name: 'Jan', dateRange: '1-31/1/27' }], T);
const item = (barcode, product, periods) => ({ barcode, product, periods });

test('productRows uses barcode identity', () => {
  const { rows, notIn } = productRows('111',
    { A: [item('111', 'Name A', {})], B: [item('111', 'Different name', {})], C: [item('222', 'x', {})] },
    { A: twd, B: twd, C: twd }, ['A', 'B', 'C']);
  assert.deepEqual(rows.map(r => r.retailer), ['A', 'B']);
  assert.deepEqual(notIn, ['C']);
});
test('now picks the live promo ending soonest', () => {
  const { rows } = productRows('111',
    { A: [item('111', 'n', { Oct: { salePrice: 90 }, 'Bro.11': { salePrice: 80 } })] }, { A: twd }, ['A']);
  assert.equal(rows[0].now.col.name, 'Oct');
  assert.equal(rows[0].nowCol.name, 'Oct');
  assert.equal(rows[0].moreLive, 1);
});
test('nowCol falls back to the first live col without a promo', () => {
  const { rows } = productRows('111', { A: [item('111', 'n', {})] }, { A: twd }, ['A']);
  assert.equal(rows[0].now, null);
  assert.equal(rows[0].nowCol.name, 'Oct');
});
test('bestNow ignores label-only promos', () => {
  const mk = (a, b) => productRows('111', {
    A: [item('111', 'n', { Oct: a })], B: [item('111', 'n', { Oct: b })] }, { A: twd, B: twd }, ['A', 'B']).rows;
  const b = bestNow(mk({ salePrice: 89 }, { salePrice: null, saleLabel: '1 แถม 1' }));
  assert.equal(b.retailer, 'A');
  assert.equal(b.price, 89);
  assert.equal(bestNow(mk({ salePrice: null, saleLabel: 'x' }, { salePrice: null, saleLabel: 'y' })), null);
});
test('next / upcoming skip past periods', () => {
  const { rows } = productRows('111', { A: [item('111', 'n', {
    'Bro.10': { salePrice: 70 }, Nov: { salePrice: 85 }, Jan: { salePrice: 75 } })] }, { A: twd }, ['A']);
  assert.equal(rows[0].nextCol.name, 'Nov');
  assert.equal(rows[0].next.pd.salePrice, 85);
  assert.equal(rows[0].upcoming.col.name, 'Jan');
});
