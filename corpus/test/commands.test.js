import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertPassages, upsertSource } from '../lib/db.js';
import { AuthError } from '../lib/anthropic.js';
import { PROMPT_VERSION } from '../lib/translate.js';
import { UsageError, parseRef, runTranslate, runShow, runTranslationsReport } from '../lib/commands.js';

const row = (over) => ({
  commentaryId: 'gill', source: 'helloao', book: 'rom', chapter: 8, verseStart: 1, endChapter: 8, verseEnd: 1,
  seq: 0, text: 'Short English text.', license: 'PD', fetchedAt: 'T', ...over,
});
function seeded() {
  const db = openDb();
  upsertSource(db, { commentaryId: 'gill', name: "Gill's Exposition", author: 'John Gill', source: 'helloao', license: 'PD' });
  upsertPassages(db, [
    row({ verseStart: 1, verseEnd: 1, text: 'First passage text.' }),
    row({ verseStart: 2, verseEnd: 4, text: 'Second passage text.' }),
    row({ verseStart: 5, verseEnd: 5, seq: 0, text: 'Third passage text.' }),
    row({ verseStart: 5, verseEnd: 5, seq: 1, text: 'Third passage, second entry.' }),
  ]);
  return db;
}
function fakeClient(replies = [{}], model = 'm1') {
  const calls = [];
  let i = 0;
  return {
    model, calls,
    async complete(args) {
      calls.push(args);
      const r = replies[Math.min(i++, replies.length - 1)];
      if (r instanceof Error) throw r;
      return { text: r.text ?? '译文', inputTokens: r.in ?? 10, outputTokens: r.out ?? 20, stopReason: r.stop ?? 'end_turn' };
    },
  };
}
const lines = () => { const out = []; return { out, log: (s) => out.push(s) }; };
const base = { commentary: 'gill', book: 'rom', ref: '8', model: 'm1' };

test('parseRef', () => {
  assert.deepEqual(parseRef('8'), { chapter: 8, verse: null });
  assert.deepEqual(parseRef('8:28'), { chapter: 8, verse: 28 });
  for (const bad of ['', 'x', '8:', ':3', '0', '8:0', '8:2:3', '-1']) {
    assert.throws(() => parseRef(bad), UsageError, `should reject ${JSON.stringify(bad)}`);
  }
});

test('translate: translates every passage in the chapter and prints one line each plus a summary', async () => {
  const db = seeded();
  const client = fakeClient();
  const { out, log } = lines();
  const code = await runTranslate({ db, client, ...base, log });
  assert.equal(code, 0);
  assert.equal(client.calls.length, 4);
  assert.deepEqual(out, [
    'gill Romans 8:1: translated (in 10 / out 20 tokens)',
    'gill Romans 8:2-4: translated (in 10 / out 20 tokens)',
    'gill Romans 8:5: translated (in 10 / out 20 tokens)',
    'gill Romans 8:5 (entry 2): translated (in 10 / out 20 tokens)',
    'Done: 4 translated, 0 cached, 0 failed; tokens in 40 / out 80',
  ]);
});

test('translate: a second run is all cached and makes no API call', async () => {
  const db = seeded();
  await runTranslate({ db, client: fakeClient(), ...base, log: () => {} });
  const client = fakeClient();
  const { out, log } = lines();
  assert.equal(await runTranslate({ db, client, ...base, log }), 0);
  assert.equal(client.calls.length, 0);
  assert.equal(out.at(-1), 'Done: 0 translated, 4 cached, 0 failed; tokens in 0 / out 0');
  assert.match(out[0], /: cached$/);
});

test('translate: a verse reference selects only the covering passage', async () => {
  const client = fakeClient();
  await runTranslate({ db: seeded(), client, ...base, ref: '8:3', log: () => {} });
  assert.equal(client.calls.length, 1);
  assert.match(client.calls[0].user, /Passage: Romans 8:2-4/);
});

test('translate: --force translates cached passages again', async () => {
  const db = seeded();
  await runTranslate({ db, client: fakeClient(), ...base, log: () => {} });
  const client = fakeClient();
  await runTranslate({ db, client, ...base, force: true, log: () => {} });
  assert.equal(client.calls.length, 4);
});

test('translate: dry-run needs no client, makes no call, and reports counts and estimates', async () => {
  const db = seeded();
  await runTranslate({ db, client: fakeClient(), ...base, ref: '8:1', log: () => {} }); // cache one
  const { out, log } = lines();
  const code = await runTranslate({ db, client: null, ...base, dryRun: true, log });
  assert.equal(code, 0);
  assert.equal(out[0], 'Matched 4 passage(s): 1 already translated, 3 to translate');
  assert.match(out[1], /^Characters to translate: 67 \(chunks: 3\)$/);
  assert.match(out[2], /^Estimate \(rough\): ~\d+ input tokens, ~\d+ output tokens$/);
  assert.equal(out[3], 'Limit check: 67 <= 30000 (--max-chars)');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM translations').get().n, 1);
});

test('translate: refuses, before any API call, a request over --max-chars', async () => {
  const client = fakeClient();
  await assert.rejects(
    runTranslate({ db: seeded(), client, ...base, maxChars: 20, log: () => {} }),
    (e) => e instanceof UsageError && /exceeds --max-chars 20/.test(e.message) && /--max-chars 86/.test(e.message),
  );
  assert.equal(client.calls.length, 0);
});

test('translate: dry-run says when a real run would be refused', async () => {
  const { out, log } = lines();
  await runTranslate({ db: seeded(), client: null, ...base, dryRun: true, maxChars: 20, log });
  assert.equal(out[3], 'Would be REFUSED: 86 characters exceeds --max-chars 20');
});

test('translate: bad input is a UsageError', async () => {
  const db = seeded();
  const call = (over) => runTranslate({ db, client: fakeClient(), ...base, ...over, log: () => {} });
  await assert.rejects(call({ commentary: 'nope' }), /Unknown commentary "nope"/);
  await assert.rejects(call({ book: 'xyz' }), /Unknown book code "xyz"/);
  await assert.rejects(call({ ref: 'abc' }), UsageError);
  await assert.rejects(call({ maxChars: 0 }), /--max-chars/);
  await assert.rejects(call({ maxChars: NaN }), /--max-chars/);
});

test('translate: no matching passages is not an error', async () => {
  const { out, log } = lines();
  assert.equal(await runTranslate({ db: seeded(), client: fakeClient(), ...base, ref: '9', log }), 0);
  assert.match(out[0], /^No passages match/);
});

test('translate: a failed passage is reported, the run continues, and the exit code is 1', async () => {
  const db = seeded();
  const client = fakeClient([{ stop: 'max_tokens' }, {}]);
  const { out, log } = lines();
  const code = await runTranslate({ db, client, ...base, log });
  assert.equal(code, 1);
  assert.match(out[0], /^gill Romans 8:1: failed: reply hit max_tokens/);
  assert.match(out[1], /translated/);
  assert.equal(out.at(-1), 'Done: 3 translated, 0 cached, 1 failed; tokens in 30 / out 60');
});

test('translate: an auth error stops the run', async () => {
  const client = fakeClient([new AuthError(401, 'bad key')]);
  await assert.rejects(runTranslate({ db: seeded(), client, ...base, log: () => {} }), AuthError);
  assert.equal(client.calls.length, 1);
});

test('show: prints English and the labelled Chinese, or says there is none yet', async () => {
  const db = seeded();
  await runTranslate({ db, client: fakeClient([{ text: '第一段译文' }]), ...base, ref: '8:1', log: () => {} });
  const { out, log } = lines();
  runShow({ db, ...base, log });
  const text = out.join('\n');
  assert.match(text, /== Romans 8:1 \[gill\] ==/);
  assert.match(text, /First passage text\./);
  assert.match(text, new RegExp(`机器翻译 / machine translation \\(m1, ${PROMPT_VERSION}\\)`));
  assert.match(text, /第一段译文/);
  assert.match(text, /\(no translation yet\)/);
});

test('show: unknown commentary or bad ref is a UsageError', () => {
  assert.throws(() => runShow({ db: seeded(), ...base, commentary: 'nope', log: () => {} }), UsageError);
  assert.throws(() => runShow({ db: seeded(), ...base, ref: 'x', log: () => {} }), UsageError);
});

test('translations report: per commentary, model and prompt version, with token sums', async () => {
  const db = seeded();
  await runTranslate({ db, client: fakeClient(), ...base, log: () => {} });
  const { out, log } = lines();
  runTranslationsReport({ db, log });
  assert.deepEqual(out, [`gill  m1  ${PROMPT_VERSION}  4 of 4 passages  in 40 / out 80 tokens`]);
});

test('translations report: says so when there are none', () => {
  const { out, log } = lines();
  runTranslationsReport({ db: openDb(), log });
  assert.deepEqual(out, ['No translations yet.']);
});
