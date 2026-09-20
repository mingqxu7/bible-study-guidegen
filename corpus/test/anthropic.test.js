import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, ApiError, AuthError } from '../lib/anthropic.js';

const res = (status, body = {}, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});
const okBody = (over = {}) => ({
  content: [{ type: 'text', text: '你好' }],
  usage: { input_tokens: 11, output_tokens: 22 },
  stop_reason: 'end_turn',
  ...over,
});

function harness(responses, opts = {}) {
  const calls = [];
  const sleeps = [];
  const queue = [...responses];
  const client = createClient({
    apiKey: 'test-key',
    model: 'm1',
    sleep: async (ms) => { sleeps.push(ms); },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return queue.length > 1 ? queue.shift() : queue[0];
    },
    ...opts,
  });
  return { client, calls, sleeps };
}
const ask = (client) => client.complete({ system: 'sys', user: 'usr', maxTokens: 100 });

test('sends the documented Messages API request', async () => {
  const { client, calls } = harness([res(200, okBody())]);
  await ask(client);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
  assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    model: 'm1', max_tokens: 100, system: 'sys', messages: [{ role: 'user', content: 'usr' }],
  });
});

test('returns joined text blocks, token usage and stop reason', async () => {
  const body = okBody({ content: [{ type: 'text', text: '甲' }, { type: 'tool_use' }, { type: 'text', text: '乙' }] });
  const { client } = harness([res(200, body)]);
  assert.deepEqual(await ask(client), { text: '甲乙', inputTokens: 11, outputTokens: 22, stopReason: 'end_turn' });
});

test('retries 429 honoring retry-after seconds', async () => {
  const { client, sleeps } = harness([res(429, {}, { 'retry-after': '2' }), res(200, okBody())]);
  assert.equal((await ask(client)).text, '你好');
  assert.deepEqual(sleeps, [2000]);
});

test('retries 5xx and 529 with exponential backoff, then succeeds', async () => {
  const { client, sleeps, calls } = harness([res(500), res(529), res(200, okBody())]);
  await ask(client);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test('gives up after maxRetries with an ApiError', async () => {
  const { client, calls } = harness([res(500, { error: { message: 'overloaded' } })], { maxRetries: 2 });
  await assert.rejects(ask(client), (e) => e instanceof ApiError && !(e instanceof AuthError) && e.status === 500 && /overloaded/.test(e.message));
  assert.equal(calls.length, 3);
});

test('401 and 403 throw AuthError immediately without retry', async () => {
  for (const status of [401, 403]) {
    const { client, calls } = harness([res(status, { error: { message: 'invalid x-api-key' } })]);
    await assert.rejects(ask(client), (e) => e instanceof AuthError && e.status === status && /invalid x-api-key/.test(e.message));
    assert.equal(calls.length, 1);
  }
});

test('other 4xx throw ApiError with the API message and are not retried', async () => {
  const { client, calls } = harness([res(400, { error: { message: 'model: not found' } })]);
  await assert.rejects(ask(client), (e) => e instanceof ApiError && !(e instanceof AuthError) && e.status === 400 && /not found/.test(e.message));
  assert.equal(calls.length, 1);
});

test('a missing api key is rejected up front', () => {
  assert.throws(() => createClient({ apiKey: '', model: 'm1' }), /ANTHROPIC_API_KEY/);
  assert.throws(() => createClient({ apiKey: undefined, model: 'm1' }), /ANTHROPIC_API_KEY/);
});

test('the api key never appears in an error message', async () => {
  const { client } = harness([res(500, { error: { message: 'boom' } })], { maxRetries: 0 });
  await assert.rejects(ask(client), (e) => !e.message.includes('test-key'));
});
