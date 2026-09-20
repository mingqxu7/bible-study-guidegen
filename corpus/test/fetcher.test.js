import test from 'node:test';
import assert from 'node:assert/strict';
import { createFetcher, HttpError, BlockedError } from '../lib/fetcher.js';

const res = (status, body = {}, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

function harness(responses, opts = {}) {
  let clock = 0;
  const sleeps = [];
  const calls = [];
  const queue = [...responses];
  const fetcher = createFetcher({
    userAgent: 'test-agent/1.0 (research)',
    minIntervalMs: 0,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    now: () => clock,
    fetchImpl: async (url, init) => {
      calls.push({ url, init, at: clock });
      return queue.length > 1 ? queue.shift() : queue[0];
    },
    ...opts,
  });
  return { fetcher, sleeps, calls };
}

test('sends the identified User-Agent and returns parsed json', async () => {
  const { fetcher, calls } = harness([res(200, { ok: 1 })]);
  assert.deepEqual(await fetcher.fetch('https://a.example/x.json'), { ok: 1 });
  assert.equal(calls[0].init.headers['User-Agent'], 'test-agent/1.0 (research)');
});

test('spaces requests to the same host by minIntervalMs', async () => {
  const { fetcher, calls } = harness([res(200)], { minIntervalMs: 1000 });
  for (let i = 0; i < 3; i++) await fetcher.fetch('https://a.example/x');
  assert.deepEqual(calls.map((c) => c.at), [0, 1000, 2000]);
});

test('hosts are limited independently and hostIntervals override', async () => {
  const { fetcher, calls } = harness([res(200)], { minIntervalMs: 0, hostIntervals: { 'slow.example': 5000 } });
  await fetcher.fetch('https://slow.example/1');
  await fetcher.fetch('https://fast.example/1');
  await fetcher.fetch('https://slow.example/2');
  assert.deepEqual(calls.map((c) => [new URL(c.url).host, c.at]),
    [['slow.example', 0], ['fast.example', 0], ['slow.example', 5000]]);
});

test('retries 429 with exponential backoff then succeeds', async () => {
  const { fetcher, sleeps, calls } = harness([res(429), res(429), res(200, { done: true })]);
  assert.deepEqual(await fetcher.fetch('https://a.example/x'), { done: true });
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test('honors Retry-After (seconds)', async () => {
  const { fetcher, sleeps } = harness([res(429, {}, { 'retry-after': '2' }), res(200)]);
  await fetcher.fetch('https://a.example/x');
  assert.deepEqual(sleeps, [2000]);
});

test('gives up after maxRetries on 5xx', async () => {
  const { fetcher, calls } = harness([res(500)], { maxRetries: 2 });
  await assert.rejects(fetcher.fetch('https://a.example/x'), (e) => e instanceof HttpError && e.status === 500);
  assert.equal(calls.length, 3);
});

test('404 is not retried', async () => {
  const { fetcher, calls } = harness([res(404)]);
  await assert.rejects(fetcher.fetch('https://a.example/x'), (e) => e instanceof HttpError && e.status === 404);
  assert.equal(calls.length, 1);
});

test('403 stops immediately with BlockedError and is never retried', async () => {
  const { fetcher, calls } = harness([res(403)]);
  await assert.rejects(fetcher.fetch('https://a.example/x'), (e) => e instanceof BlockedError && e.status === 403);
  assert.equal(calls.length, 1);
});

test('as: "response" returns the raw response', async () => {
  const { fetcher } = harness([res(200)]);
  const r = await fetcher.fetch('https://a.example/x', { as: 'response' });
  assert.equal(r.status, 200);
});
