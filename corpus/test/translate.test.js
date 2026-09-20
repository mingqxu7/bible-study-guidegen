import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertPassages, upsertSource, getTranslation } from '../lib/db.js';
import { AuthError, ApiError } from '../lib/anthropic.js';
import { selectPassages, translatePassage, PROMPT_VERSION, LANG } from '../lib/translate.js';

const row = (over) => ({
  commentaryId: 'gill', source: 'helloao', book: 'rom', chapter: 8, verseStart: 1, endChapter: 8, verseEnd: 1,
  seq: 0, text: 'text', license: 'PD', fetchedAt: 'T', ...over,
});

function seeded() {
  const db = openDb();
  upsertSource(db, { commentaryId: 'gill', name: "Gill's Exposition", author: 'John Gill', source: 'helloao', license: 'PD' });
  upsertPassages(db, [
    row({ verseStart: 1, verseEnd: 1, text: 'A' }),
    row({ verseStart: 26, verseEnd: 28, text: 'B' }),
    row({ verseStart: 30, verseEnd: 30, text: 'C' }),
    row({ verseStart: 39, endChapter: 9, verseEnd: 3, text: 'D' }),
    row({ chapter: 9, endChapter: 9, verseStart: 5, verseEnd: 5, text: 'E' }),
    row({ book: 'gen', text: 'other book' }),
    row({ commentaryId: 'wesley', text: 'other commentary' }),
  ]);
  return db;
}
const texts = (list) => list.map((p) => p.text);

test('selectPassages by chapter: every passage that starts in it, in order', () => {
  assert.deepEqual(texts(selectPassages(seeded(), 'gill', 'rom', 8)), ['A', 'B', 'C', 'D']);
});

test('selectPassages by verse: passages whose range covers it', () => {
  const db = seeded();
  assert.deepEqual(texts(selectPassages(db, 'gill', 'rom', 8, 27)), ['B']);
  assert.deepEqual(texts(selectPassages(db, 'gill', 'rom', 8, 45)), ['D']); // inside the 8:39-9:3 range
  assert.deepEqual(texts(selectPassages(db, 'gill', 'rom', 9, 1)), ['D']); // second chapter of that range
  assert.deepEqual(selectPassages(db, 'gill', 'rom', 8, 29), []);
});

test('selectPassages returns the passage key fields', () => {
  const [p] = selectPassages(seeded(), 'gill', 'rom', 8, 27);
  assert.deepEqual(p, { commentaryId: 'gill', book: 'rom', chapter: 8, verseStart: 26, endChapter: 8, verseEnd: 28, seq: 0, text: 'B' });
});

// ---- translatePassage ----

function fakeClient(replies, model = 'm1') {
  const calls = [];
  let i = 0;
  return {
    model,
    calls,
    async complete(args) {
      calls.push(args);
      const r = replies[Math.min(i++, replies.length - 1)];
      if (r instanceof Error) throw r;
      return { text: r.text ?? '译文', inputTokens: r.in ?? 10, outputTokens: r.out ?? 20, stopReason: r.stop ?? 'end_turn' };
    },
  };
}
const P = (over = {}) => ({
  commentaryId: 'gill', book: 'rom', chapter: 8, verseStart: 28, endChapter: 8, verseEnd: 28, seq: 0,
  text: 'Short English text.', ...over,
});
const lookup = (db, p = P(), model = 'm1') => getTranslation(db, p, { lang: LANG, model, promptVersion: PROMPT_VERSION });
const NOW = () => '2026-09-20T00:00:00Z';

test('translates, stores with token counts, and builds the request from the prompt', async () => {
  const db = openDb();
  const client = fakeClient([{}]);
  const result = await translatePassage(db, client, P(), { commentaryName: "Gill's Exposition", now: NOW });
  assert.deepEqual(result, { status: 'translated', inputTokens: 10, outputTokens: 20 });
  assert.deepEqual(lookup(db), { text: '译文', inputTokens: 10, outputTokens: 20, createdAt: '2026-09-20T00:00:00Z' });
  assert.equal(client.calls.length, 1);
  assert.match(client.calls[0].system, /上帝/);
  assert.match(client.calls[0].user, /Passage: Romans 8:28/);
  assert.match(client.calls[0].user, /Commentary: Gill's Exposition/);
  assert.ok(client.calls[0].user.endsWith('Short English text.'));
  assert.equal(client.calls[0].maxTokens, 16000);
});

test('a reply with no Chinese characters fails and stores nothing', async () => {
  const db = openDb();
  const client = fakeClient([{ text: 'This is still English.' }]);
  const result = await translatePassage(db, client, P({ text: 'Short English text.' }), { now: NOW });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /no Chinese characters/);
  assert.equal(lookup(db), null);
});

test('a cached translation makes no API call; force translates again', async () => {
  const db = openDb();
  const client = fakeClient([{}]);
  await translatePassage(db, client, P(), { now: NOW });
  assert.deepEqual(await translatePassage(db, client, P(), { now: NOW }), { status: 'cached' });
  assert.equal(client.calls.length, 1);
  assert.equal((await translatePassage(db, client, P(), { force: true, now: NOW })).status, 'translated');
  assert.equal(client.calls.length, 2);
});

test('the cache is per model', async () => {
  const db = openDb();
  await translatePassage(db, fakeClient([{}], 'm1'), P(), { now: NOW });
  const other = fakeClient([{}], 'm2');
  assert.equal((await translatePassage(db, other, P(), { now: NOW })).status, 'translated');
  assert.equal(other.calls.length, 1);
});

test('a long passage is chunked, stitched in order, and tokens are summed', async () => {
  const db = openDb();
  const p = P({ text: `${'a'.repeat(4000)}\n\n${'b'.repeat(4000)}` });
  const client = fakeClient([{ text: '甲'.repeat(1200), in: 5, out: 7 }, { text: '乙'.repeat(1200), in: 6, out: 8 }]);
  const result = await translatePassage(db, client, p, { now: NOW });
  assert.deepEqual(result, { status: 'translated', inputTokens: 11, outputTokens: 15 });
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[0].user, /Part 1 of 2/);
  assert.match(client.calls[1].user, /Part 2 of 2/);
  assert.equal(lookup(db, p).text, `${'甲'.repeat(1200)}\n\n${'乙'.repeat(1200)}`);
});

test('a reply that hit max_tokens fails and stores nothing', async () => {
  const db = openDb();
  const result = await translatePassage(db, fakeClient([{ stop: 'max_tokens' }]), P(), { now: NOW });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /max_tokens/);
  assert.equal(lookup(db), null);
});

test('an empty reply fails and stores nothing', async () => {
  const db = openDb();
  const result = await translatePassage(db, fakeClient([{ text: '   ' }]), P(), { now: NOW });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /empty reply/);
  assert.equal(lookup(db), null);
});

test('a badly proportioned translation fails and stores nothing', async () => {
  const db = openDb();
  const p = P({ text: 'x'.repeat(400) });
  const result = await translatePassage(db, fakeClient([{ text: '译'.repeat(10) }]), p, { now: NOW });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /length ratio/);
  assert.equal(lookup(db, p), null);
});

test('if a later chunk fails, nothing is stored for the passage', async () => {
  const db = openDb();
  const p = P({ text: `${'a'.repeat(4000)}\n\n${'b'.repeat(4000)}` });
  const client = fakeClient([{ text: '甲'.repeat(1200) }, { stop: 'max_tokens' }]);
  const result = await translatePassage(db, client, p, { now: NOW });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /part 2\/2/);
  assert.equal(lookup(db, p), null);
});

test('an API error fails the passage but an auth error stops the run', async () => {
  const db = openDb();
  const failed = await translatePassage(db, fakeClient([new ApiError(500, 'boom')]), P(), { now: NOW });
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /boom/);
  await assert.rejects(translatePassage(db, fakeClient([new AuthError(401, 'bad key')]), P(), { now: NOW }), AuthError);
  assert.equal(lookup(db), null);
});

test('an empty passage fails without calling the client or storing anything', async () => {
  const db = openDb();
  const client = fakeClient([{}]);
  const p = P({ text: '   ' });
  const result = await translatePassage(db, client, p, { now: NOW });
  assert.deepEqual(result, { status: 'failed', error: 'passage text is empty' });
  assert.equal(client.calls.length, 0);
  assert.equal(lookup(db, p), null);
});
