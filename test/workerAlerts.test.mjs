import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { bangkokToday } from '../src/promoAlerts.js';

const today = bangkokToday();
const dueDate = (days) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const entry = (retailer, days = 5, extra = {}) => ({
  retailer, period: 'Period 1', startDate: dueDate(days), activities: ['Display'], brands: ['Brand A'], ...extra,
});
const response = (status = 200, headers = {}) => new Response(null, { status, headers });
const setup = (schedule, lineResponse = response()) => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return lineResponse; };
  const env = {
    LINE_TOKEN: 'secret-token',
    ASSETS: { fetch: async () => new Response(JSON.stringify(schedule), { status: 200 }) },
  };
  return { calls, env };
};

test('sends one grouped digest with a v4 retry key', async () => {
  const { calls, env } = setup([entry('Retailer A'), entry('Retailer B', 2)]);
  await worker.scheduled({}, env);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.match(call.options.headers['X-Line-Retry-Key'], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const body = JSON.parse(call.options.body);
  assert.equal(body.messages.length, 1);
  assert.match(body.messages[0].text, /Retailer A/);
  assert.match(body.messages[0].text, /Retailer B/);
});

test('retry key is stable for the same payload and changes with payload', async () => {
  const first = setup([entry('Retailer A')]);
  await worker.scheduled({}, first.env);
  const second = setup([entry('Retailer A')]);
  await worker.scheduled({}, second.env);
  const third = setup([entry('Retailer B')]);
  await worker.scheduled({}, third.env);
  assert.equal(first.calls[0].options.headers['X-Line-Retry-Key'], second.calls[0].options.headers['X-Line-Retry-Key']);
  assert.notEqual(first.calls[0].options.headers['X-Line-Retry-Key'], third.calls[0].options.headers['X-Line-Retry-Key']);
});

test('zero due entries sends nothing', async () => {
  const { calls, env } = setup([entry('Retailer A', 1)]);
  await worker.scheduled({}, env);
  assert.equal(calls.length, 0);
});

test('malformed schedule and missing token fail before broadcast', async () => {
  const malformed = setup([{ retailer: 'Retailer A', startDate: dueDate(5), activities: [] }]);
  await assert.rejects(worker.scheduled({}, malformed.env));
  assert.equal(malformed.calls.length, 0);
  const missing = setup([entry('Retailer A')]);
  delete missing.env.LINE_TOKEN;
  await assert.rejects(worker.scheduled({}, missing.env));
  assert.equal(missing.calls.length, 0);
});

test('non-OK schedule fetch fails', async () => {
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return response(); };
  const env = { LINE_TOKEN: 'secret-token', ASSETS: { fetch: async () => response(503) } };
  await assert.rejects(worker.scheduled({}, env));
  assert.equal(calls.length, 0);
});

test('LINE failures are rethrown without logging secrets or response body', async () => {
  const { calls, env } = setup([entry('Retailer A')], new Response('do-not-log', { status: 500 }));
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { await assert.rejects(worker.scheduled({}, env)); } finally { console.log = originalLog; }
  assert.equal(calls.length, 1);
  assert.match(logs.at(-1), new RegExp(`date=${today}.*due=1.*status=500`));
  assert.doesNotMatch(logs.at(-1), /secret-token|do-not-log/);
});

test('accepted and unaccepted 409 responses are handled correctly', async () => {
  const accepted = setup([entry('Retailer A')], response(409, { 'X-Line-Accepted-Request-Id': 'accepted-1' }));
  await worker.scheduled({}, accepted.env);
  const rejected = setup([entry('Retailer A')], response(409));
  await assert.rejects(worker.scheduled({}, rejected.env));
});

test('digest chunks on line boundaries and rejects more than five messages', async () => {
  const many = Array.from({ length: 25 }, (_, i) => entry(`Retailer ${i}`, 5, { activities: ['x'.repeat(900)] }));
  const split = setup(many);
  await worker.scheduled({}, split.env);
  assert.equal(JSON.parse(split.calls[0].options.body).messages.length, 5);
  const tooMany = setup(Array.from({ length: 6 }, (_, i) => entry(`Retailer ${i}`, 5, { activities: ['x'.repeat(4990)] })));
  await assert.rejects(worker.scheduled({}, tooMany.env));
  assert.equal(tooMany.calls.length, 0);
});

test('test-alert rejects a wrong secret', async () => {
  const request = new Request('https://example.test/api/test-alert?secret=wrong', { method: 'POST' });
  const result = await worker.fetch(request, { ALERT_TEST_SECRET: 'right', ASSETS: { fetch: async () => response() } });
  assert.equal(result.status, 403);
});
