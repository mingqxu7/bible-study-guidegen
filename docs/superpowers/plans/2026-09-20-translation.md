# On-Demand Chinese Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `translate`, `show` and `translations report` commands to the `corpus/` CLI that translate a passage's English commentary into Simplified Chinese on demand with the Anthropic API and persist the result in a new `translations` table in `corpus.sqlite`.

**Architecture:** A `translations` table (same key as `passages`, plus language, model and prompt version) with two db helpers; a dependency-free Messages API client; a translator (prompt, paragraph/sentence chunking, length sanity check, per-passage cache-then-translate) and passage selection; testable command functions; thin CLI wiring. `passages` is never modified.

**Tech Stack:** Node >= 22.13 (`node:sqlite`, `node:test`, global `fetch`), ESM, no npm dependencies, no SDK.

**Spec:** `docs/superpowers/specs/2026-09-20-translation-design.md`

## Global Constraints

- No npm dependencies and no Anthropic SDK: plain `fetch` to `https://api.anthropic.com/v1/messages`.
- The API key comes only from the `ANTHROPIC_API_KEY` environment variable; it is never logged, printed, stored or written to any file. A missing key is exit code 2 (except for `--dry-run`, which needs no key).
- Nothing is sent to the API unless the user runs `translate` without `--dry-run`.
- Default model `claude-sonnet-5`; `PROMPT_VERSION = 'zh-hans-v1'`; language code `zh-Hans`; "God" is rendered 上帝 (the 和合本上帝版 convention), fixed in the prompt.
- Only `corpus/` changes (plus docs). `passages` and its data are never modified; `backend/` and `frontend/` are untouched.
- `upsertPassages`/`replacePassages`/`upsertSource`/`saveTranslation` open their own transaction and cannot be nested; never wrap them in `BEGIN`.
- A truncated (`max_tokens`), empty, or badly proportioned translation is never stored. A failed passage stores nothing.
- Translations are always labelled as machine translation (model and prompt version) wherever they are displayed.
- Commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Work on a feature branch, not `main`.
- Tests use fake clients and fake `fetch` only: no test may make a real network request or need a key.

## File Structure

```
corpus/
  lib/db.js               # + translations table, getTranslation, saveTranslation   (modify)
  lib/anthropic.js        # createClient, ApiError, AuthError
  lib/translate.js        # PROMPT_VERSION, LANG, DEFAULT_MODEL, SYSTEM_PROMPT, buildUserMessage,
                          # chunkText, stitch, cjkCount, checkRatio, formatRef,
                          # selectPassages, translatePassage
  lib/commands.js         # UsageError, parseRef, runTranslate, runShow, runTranslationsReport
  cli.js                  # + translate | show | translations report                 (modify)
  package.json            # + scripts translate, show                                (modify)
  README.md               # + translation section                                    (modify)
  test/translations-db.test.js  test/anthropic.test.js  test/translate-text.test.js
  test/translate.test.js  test/commands.test.js  test/cli.test.js
```

---

### Task 1: `translations` table and db helpers

**Files:**
- Modify: `corpus/lib/db.js`
- Test: `corpus/test/translations-db.test.js`

**Interfaces:**
- Produces: table `translations` (created by `openDb`); `getTranslation(db, key, {lang, model, promptVersion}) -> {text, inputTokens, outputTokens, createdAt} | null` where `key = {commentaryId, book, chapter, verseStart, endChapter, verseEnd, seq?}`; `saveTranslation(db, row)` where `row = {...key, lang, model, promptVersion, text, inputTokens, outputTokens, createdAt}` (upsert; replaces text, tokens and `createdAt` on a key conflict)

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/mingqxu/Projects/bible-study-guidegen
git checkout -b feat/zh-translation
```

- [ ] **Step 2: Write the failing test**

Create `corpus/test/translations-db.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, getTranslation, saveTranslation } from '../lib/db.js';

const key = { commentaryId: 'gill', book: 'rom', chapter: 8, verseStart: 28, endChapter: 8, verseEnd: 28, seq: 0 };
const meta = { lang: 'zh-Hans', model: 'm1', promptVersion: 'v1' };
const row = (over = {}) => ({
  ...key, ...meta, text: '译文', inputTokens: 10, outputTokens: 20, createdAt: '2026-09-20T00:00:00Z', ...over,
});
const count = (db) => db.prepare('SELECT COUNT(*) AS n FROM translations').get().n;

test('a fresh database has the translations table', () => {
  const db = openDb();
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'translations'").get());
});

test('opening an older database without the table adds it', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-tr-')), 'c.sqlite');
  const a = openDb(file);
  a.exec('DROP TABLE translations');
  a.close();
  const b = openDb(file);
  assert.ok(b.prepare("SELECT name FROM sqlite_master WHERE name = 'translations'").get());
  b.close();
});

test('save then get round-trips the stored fields', () => {
  const db = openDb();
  saveTranslation(db, row());
  assert.deepEqual(getTranslation(db, key, meta), {
    text: '译文', inputTokens: 10, outputTokens: 20, createdAt: '2026-09-20T00:00:00Z',
  });
});

test('get returns null when there is no translation', () => {
  assert.equal(getTranslation(openDb(), key, meta), null);
});

test('saving the same key again replaces the text and tokens', () => {
  const db = openDb();
  saveTranslation(db, row());
  saveTranslation(db, row({ text: '新译文', inputTokens: 1, outputTokens: 2, createdAt: 'T2' }));
  assert.equal(count(db), 1);
  assert.deepEqual(getTranslation(db, key, meta), { text: '新译文', inputTokens: 1, outputTokens: 2, createdAt: 'T2' });
});

test('a different model, prompt version or seq is a separate row', () => {
  const db = openDb();
  saveTranslation(db, row());
  saveTranslation(db, row({ model: 'm2' }));
  saveTranslation(db, row({ promptVersion: 'v2' }));
  saveTranslation(db, row({ seq: 1 }));
  assert.equal(count(db), 4);
  assert.equal(getTranslation(db, { ...key, seq: 1 }, meta).text, '译文');
  assert.equal(getTranslation(db, key, { ...meta, model: 'm3' }), null);
});

test('seq defaults to 0 when the key omits it', () => {
  const db = openDb();
  saveTranslation(db, row({ text: '零' }));
  const { seq, ...noSeq } = key;
  assert.equal(getTranslation(db, noSeq, meta).text, '零');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL: `getTranslation`/`saveTranslation` are not exported (and the table tests fail).

- [ ] **Step 4: Implement in `lib/db.js`**

Add the table and index to the end of the `SCHEMA` template literal (after the `idx_passages_book_chapter` line, before the closing backtick):

```sql
CREATE TABLE IF NOT EXISTS translations (
  commentary_id TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL,
  verse_end INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  lang TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  text TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (commentary_id, book, chapter, verse_start, end_chapter, verse_end, seq, lang, model, prompt_version)
);
CREATE INDEX IF NOT EXISTS idx_translations_book_chapter ON translations (book, chapter);
```

Append these two exported functions at the end of the file:

```js
export function getTranslation(db, key, { lang, model, promptVersion }) {
  const row = db.prepare(`
    SELECT text, input_tokens AS inputTokens, output_tokens AS outputTokens, created_at AS createdAt
    FROM translations
    WHERE commentary_id = ? AND book = ? AND chapter = ? AND verse_start = ? AND end_chapter = ?
      AND verse_end = ? AND seq = ? AND lang = ? AND model = ? AND prompt_version = ?`)
    .get(key.commentaryId, key.book, key.chapter, key.verseStart, key.endChapter, key.verseEnd,
      key.seq ?? 0, lang, model, promptVersion);
  return row ? { ...row } : null;
}

export function saveTranslation(db, r) {
  inTransaction(db, () => {
    db.prepare(`
      INSERT INTO translations
        (commentary_id, book, chapter, verse_start, end_chapter, verse_end, seq, lang, model,
         prompt_version, text, input_tokens, output_tokens, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (commentary_id, book, chapter, verse_start, end_chapter, verse_end, seq, lang, model, prompt_version)
      DO UPDATE SET text = excluded.text, input_tokens = excluded.input_tokens,
                    output_tokens = excluded.output_tokens, created_at = excluded.created_at`)
      .run(r.commentaryId, r.book, r.chapter, r.verseStart, r.endChapter, r.verseEnd, r.seq ?? 0,
        r.lang, r.model, r.promptVersion, r.text, r.inputTokens, r.outputTokens, r.createdAt);
  });
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (61 existing + 7 new = 68).

- [ ] **Step 6: Commit**

```bash
git add corpus/lib/db.js corpus/test/translations-db.test.js
git commit -m "feat(corpus): translations table with get/save helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Anthropic Messages API client

**Files:**
- Create: `corpus/lib/anthropic.js`
- Test: `corpus/test/anthropic.test.js`

**Interfaces:**
- Produces: `createClient({apiKey, model, fetchImpl?, sleep?, maxRetries = 4, baseBackoffMs = 1000}) -> {model, complete({system, user, maxTokens = 8192}) -> Promise<{text, inputTokens, outputTokens, stopReason}>}` (throws `Error('ANTHROPIC_API_KEY is not set')` when `apiKey` is falsy); `class ApiError(status, message)` with `.status`; `class AuthError extends ApiError` (401/403)

- [ ] **Step 1: Write the failing test**

Create `corpus/test/anthropic.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/anthropic.js'`

- [ ] **Step 3: Implement `lib/anthropic.js`**

```js
const URL = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export class ApiError extends Error {
  constructor(status, message) {
    super(`Anthropic API error ${status}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

// 401/403: the key is missing, wrong or not allowed. Never retried; the run stops.
export class AuthError extends ApiError {
  constructor(status, message) {
    super(status, message);
    this.name = 'AuthError';
  }
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient({
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  sleep = realSleep,
  maxRetries = 4,
  baseBackoffMs = 1000,
}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  async function complete({ system, user, maxTokens = 8192 }) {
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION, 'content-type': 'application/json' },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        return {
          text,
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
          stopReason: data.stop_reason,
        };
      }
      let message = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        message = err?.error?.message ?? message;
      } catch {
        // keep the HTTP status message
      }
      if (res.status === 401 || res.status === 403) throw new AuthError(res.status, message);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) throw new ApiError(res.status, message);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * 2 ** attempt);
    }
  }

  return { model, complete };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (68 + 9 = 77).

- [ ] **Step 5: Commit**

```bash
git add corpus/lib/anthropic.js corpus/test/anthropic.test.js
git commit -m "feat(corpus): dependency-free Anthropic Messages API client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Translator text handling (prompt, chunking, sanity check)

**Files:**
- Create: `corpus/lib/translate.js`
- Test: `corpus/test/translate-text.test.js`

**Interfaces:**
- Consumes: `BOOKS` (lib/books.js)
- Produces: `PROMPT_VERSION = 'zh-hans-v1'`, `LANG = 'zh-Hans'`, `DEFAULT_MODEL = 'claude-sonnet-5'`, `SYSTEM_PROMPT` (string); `buildUserMessage({commentaryName, ref, part, parts, text}) -> string`; `chunkText(text, limit = 6000) -> {text, sep}[]`; `stitch(chunks, translations) -> string`; `cjkCount(s) -> number`; `checkRatio(english, chinese) -> string | null`; `formatRef({book, chapter, verseStart, endChapter, verseEnd}) -> string`

- [ ] **Step 1: Write the failing test**

Create `corpus/test/translate-text.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_VERSION, LANG, DEFAULT_MODEL, SYSTEM_PROMPT, buildUserMessage,
  chunkText, stitch, cjkCount, checkRatio, formatRef,
} from '../lib/translate.js';

test('constants', () => {
  assert.equal(PROMPT_VERSION, 'zh-hans-v1');
  assert.equal(LANG, 'zh-Hans');
  assert.equal(DEFAULT_MODEL, 'claude-sonnet-5');
});

test('the system prompt fixes the 上帝 convention and the key rules', () => {
  assert.match(SYSTEM_PROMPT, /上帝/);
  assert.match(SYSTEM_PROMPT, /耶和华/);
  assert.match(SYSTEM_PROMPT, /Simplified Chinese/);
  assert.match(SYSTEM_PROMPT, /ONLY the Chinese translation/);
  assert.match(SYSTEM_PROMPT, /&c\./);
  assert.match(SYSTEM_PROMPT, /Never summarize/);
});

test('buildUserMessage names the commentary and passage; parts only when chunked', () => {
  const single = buildUserMessage({ commentaryName: "Gill's Exposition", ref: 'Romans 8:28', part: 1, parts: 1, text: 'Body.' });
  assert.match(single, /Commentary: Gill's Exposition/);
  assert.match(single, /Passage: Romans 8:28/);
  assert.doesNotMatch(single, /Part 1 of/);
  assert.ok(single.endsWith('\n\nBody.'));
  const multi = buildUserMessage({ commentaryName: 'X', ref: 'Y', part: 2, parts: 3, text: 'B' });
  assert.match(multi, /Part 2 of 3/);
});

test('chunkText: short text is one chunk', () => {
  assert.deepEqual(chunkText('Hello world.'), [{ text: 'Hello world.', sep: '' }]);
});

test('chunkText packs paragraphs up to the limit and remembers the separator', () => {
  const chunks = chunkText('aaaa\n\nbbbb\n\ncccc', 10);
  assert.deepEqual(chunks, [{ text: 'aaaa\n\nbbbb', sep: '\n\n' }, { text: 'cccc', sep: '' }]);
});

test('chunkText splits an oversize paragraph at sentence boundaries without inventing paragraph breaks', () => {
  const para = 'First sentence here. Second sentence here. Third one.';
  const chunks = chunkText(para, 30);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.text.length <= 30));
  assert.equal(stitch(chunks, chunks.map((c) => c.text)), para);
});

test('chunkText hard-splits a long unbroken run and stitches it back exactly', () => {
  const chunks = chunkText('abcdefghijkl', 5);
  assert.deepEqual(chunks.map((c) => c.text), ['abcde', 'fghij', 'kl']);
  assert.equal(stitch(chunks, chunks.map((c) => c.text)), 'abcdefghijkl');
});

test('chunkText ignores empty paragraphs and surrounding blank lines', () => {
  assert.deepEqual(chunkText('\n\n  one\n\n\n\ntwo\n\n'), [{ text: 'one\n\ntwo', sep: '' }]);
});

test('stitch rejoins translated chunks with the original separators and trims each', () => {
  const chunks = [{ text: 'a', sep: '\n\n' }, { text: 'b', sep: ' ' }, { text: 'c', sep: '' }];
  assert.equal(stitch(chunks, ['甲 ', ' 乙', '丙\n']), '甲\n\n乙 丙');
});

test('cjkCount counts only CJK ideographs', () => {
  assert.equal(cjkCount('上帝 is God 爱, 2 Cor 5:17'), 3);
  assert.equal(cjkCount(''), 0);
});

test('checkRatio: passes a normal ratio, fails too short and too long, skips short English', () => {
  const en = 'x'.repeat(400);
  assert.equal(checkRatio(en, '译'.repeat(120)), null); // 0.30
  assert.match(checkRatio(en, '译'.repeat(12)), /ratio 0\.03/); // 12 / 400 = 0.03
  assert.match(checkRatio(en, '译'.repeat(300)), /ratio 0\.75/);
  assert.equal(checkRatio('Short English text.', '译'), null); // under 200 characters: not checked
});

test('formatRef renders single verses, ranges and cross-chapter ranges', () => {
  const base = { book: 'rom', chapter: 8, verseStart: 28, endChapter: 8, verseEnd: 28 };
  assert.equal(formatRef(base), 'Romans 8:28');
  assert.equal(formatRef({ ...base, verseEnd: 30 }), 'Romans 8:28-30');
  assert.equal(formatRef({ ...base, endChapter: 9, verseEnd: 3 }), 'Romans 8:28-9:3');
  assert.equal(formatRef({ ...base, book: '1co' }), '1 Corinthians 8:28');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/translate.js'`

- [ ] **Step 3: Implement `lib/translate.js`**

```js
import { BOOKS } from './books.js';

export const PROMPT_VERSION = 'zh-hans-v1';
export const LANG = 'zh-Hans';
export const DEFAULT_MODEL = 'claude-sonnet-5';

export const SYSTEM_PROMPT = `You translate historic English Bible commentaries into Simplified Chinese (简体中文).

Output ONLY the Chinese translation of the text you are given: no preface, no notes, no explanations, no markdown fences.

Rules:
1. Register: formal, reverent, natural theological Chinese, as in a printed Chinese commentary. Keep the historic author's voice.
2. Use the Chinese Union Version (和合本) 上帝版 terminology: 上帝 for "God" (not 神), 耶和华 for the LORD/Jehovah, 耶稣基督, 圣灵, 以色列, 大卫, 摩西, 称义, 圣化, 救赎. Render Scripture quotations in 和合本-style wording.
3. Bible book names: standard Chinese names (Romans -> 罗马书, Genesis -> 创世记). Keep chapter:verse numerals unchanged (罗马书 8:28).
4. Keep Hebrew, Greek and Latin words exactly as written. Add a short Chinese gloss in parentheses only where the author himself explains the word.
5. Render archaic abbreviations such as "&c." as 等等 and "i.e." as 即.
6. Translate everything. Never summarize, shorten, reorder, omit or add anything. Preserve paragraph breaks, numbering and list structure.
7. Other authors and works: use the common Chinese rendering when well known, otherwise keep the original spelling.
8. If the text is marked "Part i of n", translate only that part and keep the terminology consistent with the rest of the passage.`;

export function buildUserMessage({ commentaryName, ref, part, parts, text }) {
  const partLine = parts > 1 ? `Part ${part} of ${parts}\n` : '';
  return `Commentary: ${commentaryName}\nPassage: ${ref}\n${partLine}\nTranslate the following text:\n\n${text}`;
}

// ---- chunking ----

// Splits text into pieces that each remember the separator that followed them originally:
// "\n\n" between paragraphs, " " between sentences of an oversize paragraph, "" inside a hard split.
function toPieces(text, limit) {
  const paragraphs = text.trim().split(/\n{2,}/).filter((p) => p.trim());
  const pieces = [];
  paragraphs.forEach((p, i) => {
    const paraSep = i < paragraphs.length - 1 ? '\n\n' : '';
    if (p.length <= limit) {
      pieces.push({ text: p, sep: paraSep });
      return;
    }
    const units = [];
    for (const sentence of p.split(/(?<=[.?!;])\s+/)) {
      for (let k = 0; k < sentence.length; k += limit) {
        const isLast = k + limit >= sentence.length;
        units.push({ text: sentence.slice(k, k + limit), sep: isLast ? ' ' : '' });
      }
    }
    units[units.length - 1].sep = paraSep;
    pieces.push(...units);
  });
  return pieces;
}

export function chunkText(text, limit = 6000) {
  const chunks = [];
  let cur = null;
  for (const piece of toPieces(text, limit)) {
    if (cur && cur.text.length + cur.sep.length + piece.text.length <= limit) {
      cur = { text: cur.text + cur.sep + piece.text, sep: piece.sep };
    } else {
      if (cur) chunks.push(cur);
      cur = { text: piece.text, sep: piece.sep };
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export function stitch(chunks, translations) {
  return chunks.map((c, i) => translations[i].trim() + c.sep).join('');
}

// ---- sanity check ----

export function cjkCount(s) {
  return (s.match(/[一-鿿]/g) ?? []).length;
}

// Observed on the 96-translation sample study: Chinese is 20-31% of the English length.
export function checkRatio(english, chinese) {
  if (english.length < 200) return null;
  const ratio = cjkCount(chinese) / english.length;
  if (ratio >= 0.1 && ratio <= 0.6) return null;
  return `implausible length ratio ${ratio.toFixed(2)} (expected 0.10-0.60 Chinese characters per English character)`;
}

// ---- references ----

const BOOK_NAME = Object.fromEntries(BOOKS.map((b) => [b.code, b.name]));

export function formatRef({ book, chapter, verseStart, endChapter, verseEnd }) {
  const name = BOOK_NAME[book] ?? book;
  const start = `${name} ${chapter}:${verseStart}`;
  if (endChapter !== chapter) return `${start}-${endChapter}:${verseEnd}`;
  if (verseEnd !== verseStart) return `${start}-${verseEnd}`;
  return start;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (77 + 12 = 89). If a `chunkText` case fails, check that a piece's `sep` is what followed it originally (see the comment above `toPieces`) and that the last unit of an oversize paragraph takes the paragraph's separator.

- [ ] **Step 5: Commit**

```bash
git add corpus/lib/translate.js corpus/test/translate-text.test.js
git commit -m "feat(corpus): translation prompt, chunking and length sanity check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Passage selection and `translatePassage`

**Files:**
- Modify: `corpus/lib/translate.js` (append)
- Test: `corpus/test/translate.test.js`

**Interfaces:**
- Consumes: `getTranslation`, `saveTranslation` (lib/db.js); `AuthError` (lib/anthropic.js); everything Task 3 produced
- Produces: `selectPassages(db, commentaryId, book, chapter, verse = null) -> {commentaryId, book, chapter, verseStart, endChapter, verseEnd, seq, text}[]`; `translatePassage(db, client, passage, {commentaryName?, force?, now?}) -> Promise<{status:'cached'} | {status:'translated', inputTokens, outputTokens} | {status:'failed', error}>` where `client = {model, complete}`; an `AuthError` from the client is rethrown

- [ ] **Step 1: Write the failing test**

Create `corpus/test/translate.test.js`:

```js
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
  assert.equal(client.calls[0].maxTokens, 8192);
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `selectPassages`/`translatePassage` are not exported from `../lib/translate.js`.

- [ ] **Step 3: Implement**

Add these imports at the top of `corpus/lib/translate.js` (above the existing `BOOKS` import):

```js
import { AuthError } from './anthropic.js';
import { getTranslation, saveTranslation } from './db.js';
```

Append to the end of `corpus/lib/translate.js`:

```js
// ---- selecting passages ----

// chapter only: passages that start in that chapter.
// chapter + verse: passages whose range covers that verse (ranges may cross chapters).
export function selectPassages(db, commentaryId, book, chapter, verse = null) {
  let sql = `SELECT commentary_id AS commentaryId, book, chapter, verse_start AS verseStart,
      end_chapter AS endChapter, verse_end AS verseEnd, seq, text
    FROM passages WHERE commentary_id = ? AND book = ? AND `;
  const args = [commentaryId, book];
  if (verse === null) {
    sql += 'chapter = ?';
    args.push(chapter);
  } else {
    sql += '(chapter < ? OR (chapter = ? AND verse_start <= ?)) AND (end_chapter > ? OR (end_chapter = ? AND verse_end >= ?))';
    args.push(chapter, chapter, verse, chapter, chapter, verse);
  }
  sql += ' ORDER BY chapter, verse_start, seq';
  return db.prepare(sql).all(...args).map((r) => ({ ...r }));
}

// ---- translating one passage ----

const MAX_TOKENS = 8192;

export async function translatePassage(db, client, passage, opts = {}) {
  const { commentaryName = passage.commentaryId, force = false, now = () => new Date().toISOString() } = opts;
  const key = {
    commentaryId: passage.commentaryId, book: passage.book, chapter: passage.chapter, verseStart: passage.verseStart,
    endChapter: passage.endChapter, verseEnd: passage.verseEnd, seq: passage.seq,
  };
  const where = { lang: LANG, model: client.model, promptVersion: PROMPT_VERSION };
  if (!force && getTranslation(db, key, where)) return { status: 'cached' };

  const chunks = chunkText(passage.text);
  const ref = formatRef(passage);
  const translated = [];
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for (let i = 0; i < chunks.length; i++) {
      const res = await client.complete({
        system: SYSTEM_PROMPT,
        user: buildUserMessage({ commentaryName, ref, part: i + 1, parts: chunks.length, text: chunks[i].text }),
        maxTokens: MAX_TOKENS,
      });
      if (res.stopReason === 'max_tokens') throw new Error(`reply hit max_tokens on part ${i + 1}/${chunks.length}`);
      const text = res.text.trim();
      if (!text) throw new Error(`empty reply on part ${i + 1}/${chunks.length}`);
      translated.push(text);
      inputTokens += res.inputTokens;
      outputTokens += res.outputTokens;
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    return { status: 'failed', error: err.message };
  }

  const text = stitch(chunks, translated);
  const problem = checkRatio(passage.text, text);
  if (problem) return { status: 'failed', error: problem };

  saveTranslation(db, { ...key, ...where, text, inputTokens, outputTokens, createdAt: now() });
  return { status: 'translated', inputTokens, outputTokens };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (89 + 12 = 101).

- [ ] **Step 5: Commit**

```bash
git add corpus/lib/translate.js corpus/test/translate.test.js
git commit -m "feat(corpus): passage selection and cached, chunked passage translation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Command functions (`translate`, `show`, `translations report`)

**Files:**
- Create: `corpus/lib/commands.js`
- Test: `corpus/test/commands.test.js`

**Interfaces:**
- Consumes: `BOOKS` (lib/books.js); `getTranslation` (lib/db.js); `selectPassages`, `translatePassage`, `chunkText`, `formatRef`, `PROMPT_VERSION`, `LANG` (lib/translate.js); `AuthError` propagates untouched
- Produces: `class UsageError extends Error`; `parseRef(ref) -> {chapter, verse|null}` (throws `UsageError`); `runTranslate({db, client, model, commentary, book, ref, force?, dryRun?, maxChars?, log?}) -> Promise<number>` (returns the exit code 0 or 1; throws `UsageError` for bad input or an over-limit request); `runShow({db, model, commentary, book, ref, log?}) -> void`; `runTranslationsReport({db, log?}) -> void`. `client` may be `null` when `dryRun` is true.

Output formats (tests assert these): per passage `"<commentary> <ref>[ (entry N)]: translated (in X / out Y tokens)"`, `": cached"`, or `": failed: <error>"`; summary `"Done: T translated, C cached, F failed; tokens in X / out Y"`. Dry run prints `"Matched N passage(s): C already translated, T to translate"`, `"Characters to translate: N (chunks: K)"`, `"Estimate (rough): ~I input tokens, ~O output tokens"`, and either `"Limit check: N <= M (--max-chars)"` or `"Would be REFUSED: N characters exceeds --max-chars M"`.

- [ ] **Step 1: Write the failing test**

Create `corpus/test/commands.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/commands.js'`

- [ ] **Step 3: Implement `lib/commands.js`**

```js
import { BOOKS } from './books.js';
import { getTranslation } from './db.js';
import { LANG, PROMPT_VERSION, chunkText, formatRef, selectPassages, translatePassage } from './translate.js';

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseRef(ref) {
  const m = /^(\d+)(?::(\d+))?$/.exec(String(ref ?? ''));
  if (!m || Number(m[1]) < 1 || (m[2] !== undefined && Number(m[2]) < 1)) {
    throw new UsageError(`Bad reference "${ref}". Use <chapter> or <chapter>:<verse>, e.g. 8 or 8:28.`);
  }
  return { chapter: Number(m[1]), verse: m[2] === undefined ? null : Number(m[2]) };
}

function resolve(db, commentary, book, ref) {
  const { chapter, verse } = parseRef(ref);
  const source = db.prepare('SELECT name FROM sources WHERE commentary_id = ?').get(commentary);
  if (!source) {
    const known = db.prepare('SELECT commentary_id FROM sources ORDER BY commentary_id').all().map((r) => r.commentary_id);
    throw new UsageError(`Unknown commentary "${commentary}". Known: ${known.join(', ') || '(none ingested)'}`);
  }
  if (!BOOKS.some((b) => b.code === book)) {
    throw new UsageError(`Unknown book code "${book}". Use the 3-letter codes, e.g. rom, gen, 1co.`);
  }
  return { name: source.name, passages: selectPassages(db, commentary, book, chapter, verse) };
}

const label = (p) => formatRef(p) + (p.seq > 0 ? ` (entry ${p.seq + 1})` : '');

export async function runTranslate({
  db, client, model, commentary, book, ref, force = false, dryRun = false, maxChars = 30000, log = console.log,
}) {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new UsageError('--max-chars must be a positive integer');
  const { name, passages } = resolve(db, commentary, book, ref);
  if (!passages.length) {
    log(`No passages match ${commentary} ${book} ${ref}.`);
    return 0;
  }
  const where = { lang: LANG, model, promptVersion: PROMPT_VERSION };
  const isCached = (p) => !force && getTranslation(db, p, where) !== null;
  const todo = passages.filter((p) => !isCached(p));
  const chars = todo.reduce((n, p) => n + p.text.length, 0);

  if (dryRun) {
    const chunks = todo.reduce((n, p) => n + chunkText(p.text).length, 0);
    log(`Matched ${passages.length} passage(s): ${passages.length - todo.length} already translated, ${todo.length} to translate`);
    log(`Characters to translate: ${chars} (chunks: ${chunks})`);
    log(`Estimate (rough): ~${Math.round(chars / 4 + 500 * chunks)} input tokens, ~${Math.round(chars * 0.4)} output tokens`);
    log(chars <= maxChars
      ? `Limit check: ${chars} <= ${maxChars} (--max-chars)`
      : `Would be REFUSED: ${chars} characters exceeds --max-chars ${maxChars}`);
    return 0;
  }
  if (chars > maxChars) {
    throw new UsageError(
      `Refusing: ${chars} characters to translate exceeds --max-chars ${maxChars}. ` +
      `Narrow the reference, or pass --max-chars ${chars} to allow it.`,
    );
  }

  const tally = { translated: 0, cached: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
  for (const p of passages) {
    const r = await translatePassage(db, client, p, { commentaryName: name, force });
    if (r.status === 'translated') {
      tally.translated++;
      tally.inputTokens += r.inputTokens;
      tally.outputTokens += r.outputTokens;
      log(`${commentary} ${label(p)}: translated (in ${r.inputTokens} / out ${r.outputTokens} tokens)`);
    } else if (r.status === 'cached') {
      tally.cached++;
      log(`${commentary} ${label(p)}: cached`);
    } else {
      tally.failed++;
      log(`${commentary} ${label(p)}: failed: ${r.error}`);
    }
  }
  log(`Done: ${tally.translated} translated, ${tally.cached} cached, ${tally.failed} failed; tokens in ${tally.inputTokens} / out ${tally.outputTokens}`);
  return tally.failed > 0 ? 1 : 0;
}

export function runShow({ db, model, commentary, book, ref, log = console.log }) {
  const { passages } = resolve(db, commentary, book, ref);
  if (!passages.length) log(`No passages match ${commentary} ${book} ${ref}.`);
  for (const p of passages) {
    log(`== ${label(p)} [${commentary}] ==`);
    log(p.text);
    const t = getTranslation(db, p, { lang: LANG, model, promptVersion: PROMPT_VERSION });
    if (t) {
      log(`--- 机器翻译 / machine translation (${model}, ${PROMPT_VERSION}) ---`);
      log(t.text);
    } else {
      log('(no translation yet)');
    }
    log('');
  }
}

export function runTranslationsReport({ db, log = console.log }) {
  const rows = db.prepare(`
    SELECT commentary_id AS c, model, prompt_version AS pv, COUNT(*) AS n,
           SUM(input_tokens) AS tin, SUM(output_tokens) AS tout
    FROM translations GROUP BY commentary_id, model, prompt_version ORDER BY commentary_id, model, prompt_version`).all();
  if (!rows.length) {
    log('No translations yet.');
    return;
  }
  for (const r of rows) {
    const total = db.prepare('SELECT COUNT(*) AS n FROM passages WHERE commentary_id = ?').get(r.c).n;
    log(`${r.c}  ${r.model}  ${r.pv}  ${r.n} of ${total} passages  in ${r.tin} / out ${r.tout} tokens`);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (101 + 16 = 117). The seeded note texts are 19, 20, 19 and 28 characters (86 in all); with the first cached, 67 remain to translate, which is what the dry-run assertions expect.

- [ ] **Step 5: Commit**

```bash
git add corpus/lib/commands.js corpus/test/commands.test.js
git commit -m "feat(corpus): translate, show and translations-report command functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: CLI wiring, README, scripts

**Files:**
- Modify: `corpus/cli.js`, `corpus/package.json`, `corpus/README.md`
- Test: `corpus/test/cli.test.js`

**Interfaces:**
- Consumes: `createClient`, `AuthError` (lib/anthropic.js); `DEFAULT_MODEL` (lib/translate.js); `UsageError`, `runTranslate`, `runShow`, `runTranslationsReport` (lib/commands.js)
- Produces: CLI commands `translate <commentary> <book> <chapter>[:<verse>] [--model id] [--force] [--dry-run] [--max-chars n]`, `show <commentary> <book> <chapter>[:<verse>] [--model id]`, `translations report`; exit codes 0 ok, 1 failed passage or usage error, 2 missing `ANTHROPIC_API_KEY` (not for `--dry-run`), 3 `AuthError` or `BlockedError`

- [ ] **Step 1: Write the failing test**

Create `corpus/test/cli.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, upsertPassages, upsertSource } from '../lib/db.js';

const cli = new URL('../cli.js', import.meta.url).pathname;

function seededFile() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-cli-')), 'c.sqlite');
  const db = openDb(file);
  upsertSource(db, { commentaryId: 'gill', name: "Gill's Exposition", author: 'John Gill', source: 'helloao', license: 'PD' });
  upsertPassages(db, [{
    commentaryId: 'gill', source: 'helloao', book: 'rom', chapter: 8, verseStart: 28, endChapter: 8, verseEnd: 28,
    seq: 0, text: 'A short English note.', license: 'PD', fetchedAt: 'T',
  }]);
  db.close();
  return file;
}

function run(args, env = {}) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ANTHROPIC_API_KEY: '', ...env },
  });
}

test('translate without ANTHROPIC_API_KEY exits 2 with a clear message', () => {
  const r = run(['translate', 'gill', 'rom', '8:28', '--db', seededFile()]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ANTHROPIC_API_KEY/);
});

test('translate --dry-run needs no key and reports counts', () => {
  const r = run(['translate', 'gill', 'rom', '8:28', '--dry-run', '--db', seededFile()]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Matched 1 passage\(s\): 0 already translated, 1 to translate/);
  assert.match(r.stdout, /Estimate \(rough\)/);
});

test('an unknown commentary is a usage error with exit 1', () => {
  const r = run(['translate', 'nope', 'rom', '8', '--dry-run', '--db', seededFile()]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown commentary "nope"/);
});

test('show works without a key and says there is no translation yet', () => {
  const r = run(['show', 'gill', 'rom', '8:28', '--db', seededFile()]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /A short English note\./);
  assert.match(r.stdout, /\(no translation yet\)/);
});

test('translations report works on a database with none', () => {
  const r = run(['translations', 'report', '--db', seededFile()]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /No translations yet\./);
});

test('the usage line mentions the new commands', () => {
  const r = run([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /translate/);
  assert.match(r.stderr, /show/);
  assert.match(r.stderr, /translations report/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL: the CLI does not know the new commands (usage error, wrong exit codes).

- [ ] **Step 3: Edit `cli.js`**

Add imports (next to the existing ones):

```js
import { AuthError, createClient } from './lib/anthropic.js';
import { UsageError, runShow, runTranslate, runTranslationsReport } from './lib/commands.js';
import { DEFAULT_MODEL } from './lib/translate.js';
```

Add these options to the `parseArgs` `options` object:

```js
    model: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'max-chars': { type: 'string', default: '30000' },
```

Add these branches in `main()`, directly after the `report` branch:

```js
  if (command === 'translate') {
    const [, commentary, book, ref] = positionals;
    const model = values.model ?? DEFAULT_MODEL;
    const dryRun = values['dry-run'];
    let client = null;
    if (!dryRun) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('Set ANTHROPIC_API_KEY in your environment to translate (use --dry-run to preview without a key).');
        process.exit(2);
      }
      client = createClient({ apiKey, model });
    }
    process.exitCode = await runTranslate({
      db: openDb(values.db), client, model, commentary, book, ref,
      force: values.force, dryRun, maxChars: Number(values['max-chars']),
    });
    return;
  }
  if (command === 'show') {
    const [, commentary, book, ref] = positionals;
    runShow({ db: openDb(values.db), model: values.model ?? DEFAULT_MODEL, commentary, book, ref });
    return;
  }
  if (command === 'translations' && source === 'report') {
    runTranslationsReport({ db: openDb(values.db) });
    return;
  }
```

Replace the usage line with:

```js
  console.error('Usage: cli.js ingest helloao [--commentary <helloao-id>] [--book ROM ...] | ingest sword [--commentary Wesley|Barnes|Luther] | report | translate <commentary> <book> <chapter>[:<verse>] [--model id] [--force] [--dry-run] [--max-chars n] | show <commentary> <book> <chapter>[:<verse>] [--model id] | translations report  [--db path]');
```

Replace the final `.catch` handler with:

```js
main().catch((err) => {
  const quiet = err instanceof BlockedError || err instanceof AuthError || err instanceof UsageError;
  console.error(quiet ? err.message : err);
  process.exit(err instanceof BlockedError || err instanceof AuthError ? 3 : 1);
});
```

- [ ] **Step 4: Edit `package.json` and `README.md`**

In `corpus/package.json` add two scripts after `"report"`:

```json
    "translate": "node --disable-warning=ExperimentalWarning cli.js translate",
    "show": "node --disable-warning=ExperimentalWarning cli.js show"
```
(add a comma after the `"report"` line so the JSON stays valid).

In `corpus/README.md`, add before the "Not included yet" paragraph:

```
### Chinese translation (on demand)

Translate a passage's commentary into Simplified Chinese with the Anthropic API and keep it in
`corpus.sqlite` (table `translations`; the English `passages` are never changed):

    export ANTHROPIC_API_KEY=...                       # your key; never stored or printed
    npm run translate -- gill rom 8:28 --dry-run       # preview: counts and rough token estimate, no key needed
    npm run translate -- gill rom 8:28                 # translate and store (default model claude-sonnet-5)
    npm run show -- gill rom 8:28                      # English + stored Chinese, labelled machine translation
    npm run translate -- gill rom 8                    # a whole chapter
    node cli.js translations report                    # translated counts and token totals

A repeat request reads the stored translation and costs nothing. `--force` translates again;
`--max-chars` (default 30000) refuses a request that would translate more than that many characters.
Translations always render "God" as 上帝 (和合本上帝版 terms) and are labelled with the model and prompt
version. Nothing is sent to the API unless you run `translate` without `--dry-run`.
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (117 + 6 = 123). Also confirm no stray database: `ls corpus/*.sqlite` should show only the existing `corpus.sqlite`.

- [ ] **Step 6: Offline check of the real commands against the real database (no API call)**

Run: `cd corpus && node --disable-warning=ExperimentalWarning cli.js translate wesley gen 3:1 --dry-run`
Expected: `Matched 1 passage(s): 0 already translated, 1 to translate`, `Characters to translate: 2124 (chunks: 1)`, a rough estimate, and `Limit check: 2124 <= 30000 (--max-chars)`. (Wesley's Genesis 3:1-5 note is one 2,124-character passage.)

Run: `cd corpus && node --disable-warning=ExperimentalWarning cli.js translate wesley gen 3:1; echo "exit=$?"` with `ANTHROPIC_API_KEY` unset
Expected: the "Set ANTHROPIC_API_KEY" message and `exit=2`.

Run: `cd corpus && node --disable-warning=ExperimentalWarning cli.js show wesley gen 3:1`
Expected: the English text and `(no translation yet)`.

- [ ] **Step 7: Commit**

```bash
git add corpus/cli.js corpus/package.json corpus/README.md corpus/test/cli.test.js
git commit -m "feat(corpus): translate, show and translations report commands

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Live check (controller/user only; not a subagent step)**

With the user's own key exported in their shell:
1. `node cli.js translate wesley gen 3:1 --dry-run` (as in Step 6).
2. `node cli.js translate wesley gen 3:1` (one real Sonnet call, a few cents at most) and confirm it prints `translated (in N / out M tokens)`.
3. `node cli.js show wesley gen 3:1` and confirm the Chinese is complete, uses 上帝, and is labelled `机器翻译 / machine translation (claude-sonnet-5, zh-hans-v1)`.
4. Repeat step 2: it must print `cached` with no token use.
5. `node cli.js translations report` shows `wesley  claude-sonnet-5  zh-hans-v1  1 of 16715 passages ...`.

---

## Self-Review Notes

- **Spec coverage:** storage and helpers (Task 1); API client with retries, auth handling, no-SDK, key only from env (Task 2); prompt with 上帝, chunking with preserved separators, length sanity check (Task 3); passage selection, cache, atomic per-passage storage, truncation/empty/ratio guards, `AuthError` rethrown (Task 4); `--dry-run`, `--max-chars` refusal, `--force`, `show`, `translations report`, per-passage output and exit codes (Task 5, wired in Task 6); README, scripts, offline and live checks (Task 6).
- **Placeholders:** none.
- **Type consistency:** the passage/key shape `{commentaryId, book, chapter, verseStart, endChapter, verseEnd, seq, text}` is the same in `selectPassages`, `translatePassage`, `getTranslation`, `saveTranslation` and the tests; the client interface `{model, complete({system, user, maxTokens}) -> {text, inputTokens, outputTokens, stopReason}}` is the same in `anthropic.js`, `translate.js` and the fakes; command return values (exit codes 0/1) match the CLI.
