import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, dueToday, upcomingWithin, bangkokToday } from '../src/promoAlerts.js';

test('daysUntil counts whole days', () => {
  assert.equal(daysUntil('2026-01-07', '2026-01-02'), 5);
  assert.equal(daysUntil('2026-01-07', '2026-01-05'), 2);
  assert.equal(daysUntil('2026-01-07', '2026-01-07'), 0);
});

test('dueToday matches only 5 and 2 days out', () => {
  const s = [{ startDate: '2026-01-07' }, { startDate: '2026-01-10' }];
  assert.deepEqual(dueToday(s, '2026-01-02').map(e => e.startDate), ['2026-01-07']); // 5 out, 8 out
  assert.deepEqual(dueToday(s, '2026-01-05').map(e => e.startDate), ['2026-01-07', '2026-01-10']); // 2 and 5 out
  assert.equal(dueToday(s, '2026-01-06').length, 0);                                  // 1 out, 4 out
});

test('upcomingWithin is inclusive 0..days', () => {
  const s = [{ startDate: '2026-01-07' }];
  assert.equal(upcomingWithin(s, '2026-01-02', 5).length, 1); // 5 out
  assert.equal(upcomingWithin(s, '2026-01-01', 5).length, 0); // 6 out
  assert.equal(upcomingWithin(s, '2026-01-08', 5).length, 0); // past
});

test('bangkokToday rolls over with +7h offset', () => {
  assert.equal(bangkokToday(new Date('2026-01-06T18:00:00Z')), '2026-01-07'); // 01:00 BKK next day
  assert.equal(bangkokToday(new Date('2026-01-06T10:00:00Z')), '2026-01-06'); // 17:00 BKK same day
});
