# Commentary Research Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `corpus/` package that ingests public-domain Bible commentaries from HelloAO and the HistoricalChristianFaith database into one normalized sqlite file, with a coverage/license report.

**Architecture:** Zero-dependency Node package. A shared polite fetcher (honest User-Agent, per-host rate limit, backoff, stop on 403) feeds two source adapters that emit normalized `passages` rows into sqlite via `node:sqlite`. Raw downloads are cached on disk so reruns are resumable and idempotent.

**Tech Stack:** Node >= 22.13 (`node:sqlite`, `node:test`, global `fetch`), ESM. No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-20-commentary-corpus-design.md`

**Spec deltas decided while planning (spec updated to match):**
- `passages` gets `end_chapter` and `seq` columns. HCF ranges can cross chapters (`1_57-2_32`) and one file can hold several excerpts for the same range.
- sqlite driver is Node's built-in `node:sqlite` (resolves spec open item 1). No `better-sqlite3`.
- The contact address for the User-Agent comes from the `CORPUS_CONTACT` env var (resolves open item 3).
- **SWORD ingestion is deferred to a follow-up plan** (spec open item 2 allowed this). Barnes (NT only) is therefore not in this plan's output. HCF ingestion is limited to an allowlist of public-domain authors (Lapide, Wesley, Luther) because the HCF LICENSE says some excerpts in the database are copyrighted fair-use excerpts.

## Global Constraints

- No StudyLight.org access of any kind. It serves a Cloudflare Managed Challenge to automated clients; we do not circumvent it, and this pipeline never contacts it.
- No traffic disguise (randomized "study-like" access patterns, spoofed browser identity). All requests use an honest, identified User-Agent.
- No copyrighted commentaries (Scofield, Ironside, McGee, Constable, Orchard).
- Standalone package at repo root `corpus/` with its own `package.json`; no changes to `backend/` or `frontend/`.
- Books use the existing 3-letter codes from `backend/services/commentaryMapping.js` (`bookMapping`).
- Retry with exponential backoff on 429/5xx; abort the source on repeated 403 (treat as "blocked, stop", never work around it).
- Bulk-friendly sources use a small worker pool; the limiter, not the pool size, sets the load on the server. Defaults: HelloAO 2 concurrent and roughly 5 req/s max.
- Each row carries its license. A source whose terms disallow local copying is skipped and reported.
- Work on a feature branch, not `main`.

## File Structure

```
corpus/
  package.json          # scripts, engines
  .gitignore            # cache/, *.sqlite
  README.md             # usage
  cli.js                # `ingest helloao|hcf`, `report`
  lib/
    books.js            # 66-book table + USFM/HCF name -> repo code maps
    db.js               # schema, openDb, upsertSource, upsertPassages, replacePassages
    fetcher.js          # createFetcher, HttpError, BlockedError
    licenses.js         # PD mark URL, HelloAO + HCF source metadata
    report.js           # coverage(db), formatReport(db)
  sources/
    helloao.js          # parseChapter, ingestHelloao
    hcf.js              # downloadRelease, ingestHcf
  test/
    books.test.js
    db.test.js
    fetcher.test.js
    helloao.test.js
    hcf.test.js
    report.test.js
```

---

### Task 1: Scaffold, book table, database layer

**Files:**
- Create: `corpus/package.json`, `corpus/.gitignore`, `corpus/lib/books.js`, `corpus/lib/db.js`
- Test: `corpus/test/books.test.js`, `corpus/test/db.test.js`

**Interfaces:**
- Produces:
  - `books.js`: `BOOKS: {code, usfm, name}[]` (66), `USFM_TO_CODE: Record<string,string>`, `HCF_NAME_TO_CODE: Record<string,string>` (keys like `'1corinthians'`, `'songofsolomon'`)
  - `db.js`: `openDb(path = ':memory:') -> DatabaseSync`; `upsertSource(db, {commentaryId, name, author, source, sourceUrl, license, attribution, notes})`; `upsertPassages(db, rows)`; `replacePassages(db, commentaryId, rows)` where a row is `{commentaryId, source, book, chapter, verseStart, endChapter, verseEnd, seq?, text, license, fetchedAt}`

- [ ] **Step 1: Create the feature branch and package files**

```bash
cd /Users/mingqxu/Projects/bible-study-guidegen
git checkout -b feat/commentary-corpus
mkdir -p corpus/lib corpus/sources corpus/test
```

Create `corpus/package.json`:

```json
{
  "name": "bible-commentary-corpus",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "test": "node --disable-warning=ExperimentalWarning --test \"test/*.test.js\"",
    "ingest": "node --disable-warning=ExperimentalWarning cli.js ingest",
    "report": "node --disable-warning=ExperimentalWarning cli.js report"
  }
}
```

Create `corpus/.gitignore`:

```
cache/
*.sqlite
*.sqlite-journal
```

- [ ] **Step 2: Write the failing book-table test**

Create `corpus/test/books.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS, USFM_TO_CODE, HCF_NAME_TO_CODE } from '../lib/books.js';
import { bibleBounds } from '../../backend/services/bibleBounds.js';

// Book ids returned by HelloAO's john-gill books.json (verified live 2026-09-20).
const HELLOAO_IDS =
  'GEN,EXO,LEV,NUM,DEU,JOS,JDG,RUT,1SA,2SA,1KI,2KI,1CH,2CH,EZR,NEH,EST,JOB,PSA,PRO,ECC,SNG,ISA,JER,LAM,EZK,DAN,HOS,JOL,AMO,OBA,JON,MIC,NAM,HAB,ZEP,HAG,ZEC,MAL,MAT,MRK,LUK,JHN,ACT,ROM,1CO,2CO,GAL,EPH,PHP,COL,1TH,2TH,1TI,2TI,TIT,PHM,HEB,JAS,1PE,2PE,1JN,2JN,3JN,JUD,REV'.split(',');

test('66 books with unique codes and usfm ids', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(new Set(BOOKS.map((b) => b.code)).size, 66);
  assert.equal(new Set(BOOKS.map((b) => b.usfm)).size, 66);
});

test('every code exists in the app bibleBounds table', () => {
  for (const b of BOOKS) assert.ok(bibleBounds[b.code], `missing in bibleBounds: ${b.code}`);
});

test('every HelloAO book id maps to a code', () => {
  for (const id of HELLOAO_IDS) assert.ok(USFM_TO_CODE[id], `unmapped USFM id: ${id}`);
  assert.equal(HELLOAO_IDS.length, 66);
});

test('spot-check the maps', () => {
  assert.equal(USFM_TO_CODE.PHP, 'phi');
  assert.equal(USFM_TO_CODE.JHN, 'joh');
  assert.equal(USFM_TO_CODE.EZK, 'eze');
  assert.equal(HCF_NAME_TO_CODE['1corinthians'], '1co');
  assert.equal(HCF_NAME_TO_CODE.songofsolomon, 'sng');
  assert.equal(HCF_NAME_TO_CODE.psalms, 'psa');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/books.js'`

- [ ] **Step 4: Implement `lib/books.js`**

```js
// [repo code (matches backend bibleBounds), USFM id used by HelloAO, English name used by HCF]
const ROWS = [
  ['gen', 'GEN', 'Genesis'], ['exo', 'EXO', 'Exodus'], ['lev', 'LEV', 'Leviticus'],
  ['num', 'NUM', 'Numbers'], ['deu', 'DEU', 'Deuteronomy'], ['jos', 'JOS', 'Joshua'],
  ['jdg', 'JDG', 'Judges'], ['rut', 'RUT', 'Ruth'], ['1sa', '1SA', '1 Samuel'],
  ['2sa', '2SA', '2 Samuel'], ['1ki', '1KI', '1 Kings'], ['2ki', '2KI', '2 Kings'],
  ['1ch', '1CH', '1 Chronicles'], ['2ch', '2CH', '2 Chronicles'], ['ezr', 'EZR', 'Ezra'],
  ['neh', 'NEH', 'Nehemiah'], ['est', 'EST', 'Esther'], ['job', 'JOB', 'Job'],
  ['psa', 'PSA', 'Psalms'], ['pro', 'PRO', 'Proverbs'], ['ecc', 'ECC', 'Ecclesiastes'],
  ['sng', 'SNG', 'Song of Solomon'], ['isa', 'ISA', 'Isaiah'], ['jer', 'JER', 'Jeremiah'],
  ['lam', 'LAM', 'Lamentations'], ['eze', 'EZK', 'Ezekiel'], ['dan', 'DAN', 'Daniel'],
  ['hos', 'HOS', 'Hosea'], ['joe', 'JOL', 'Joel'], ['amo', 'AMO', 'Amos'],
  ['oba', 'OBA', 'Obadiah'], ['jon', 'JON', 'Jonah'], ['mic', 'MIC', 'Micah'],
  ['nah', 'NAM', 'Nahum'], ['hab', 'HAB', 'Habakkuk'], ['zep', 'ZEP', 'Zephaniah'],
  ['hag', 'HAG', 'Haggai'], ['zec', 'ZEC', 'Zechariah'], ['mal', 'MAL', 'Malachi'],
  ['mat', 'MAT', 'Matthew'], ['mar', 'MRK', 'Mark'], ['luk', 'LUK', 'Luke'],
  ['joh', 'JHN', 'John'], ['act', 'ACT', 'Acts'], ['rom', 'ROM', 'Romans'],
  ['1co', '1CO', '1 Corinthians'], ['2co', '2CO', '2 Corinthians'], ['gal', 'GAL', 'Galatians'],
  ['eph', 'EPH', 'Ephesians'], ['phi', 'PHP', 'Philippians'], ['col', 'COL', 'Colossians'],
  ['1th', '1TH', '1 Thessalonians'], ['2th', '2TH', '2 Thessalonians'],
  ['1ti', '1TI', '1 Timothy'], ['2ti', '2TI', '2 Timothy'], ['tit', 'TIT', 'Titus'],
  ['phm', 'PHM', 'Philemon'], ['heb', 'HEB', 'Hebrews'], ['jam', 'JAS', 'James'],
  ['1pe', '1PE', '1 Peter'], ['2pe', '2PE', '2 Peter'], ['1jo', '1JN', '1 John'],
  ['2jo', '2JN', '2 John'], ['3jo', '3JN', '3 John'], ['jud', 'JUD', 'Jude'],
  ['rev', 'REV', 'Revelation'],
];

export const BOOKS = ROWS.map(([code, usfm, name]) => ({ code, usfm, name }));
export const USFM_TO_CODE = Object.fromEntries(BOOKS.map((b) => [b.usfm, b.code]));
// HCF stores book as the English name, lowercased, spaces removed ("1 Corinthians" -> "1corinthians").
export const HCF_NAME_TO_CODE = Object.fromEntries(
  BOOKS.map((b) => [b.name.toLowerCase().replace(/ /g, ''), b.code]),
);
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: 4 tests PASS. If "missing in bibleBounds" fails for a code, fix that row's repo code to match `backend/services/bibleBounds.js`.

- [ ] **Step 6: Write the failing database test**

Create `corpus/test/db.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertSource, upsertPassages, replacePassages } from '../lib/db.js';

const row = (over = {}) => ({
  commentaryId: 'gill', source: 'helloao', book: 'rom', chapter: 1, verseStart: 1,
  endChapter: 1, verseEnd: 1, text: 'first', license: 'PD', fetchedAt: '2026-09-20T00:00:00Z', ...over,
});
const count = (db) => db.prepare('SELECT COUNT(*) AS n FROM passages').get().n;

test('upsertPassages is idempotent and updates text', () => {
  const db = openDb();
  upsertPassages(db, [row()]);
  upsertPassages(db, [row({ text: 'second' })]);
  assert.equal(count(db), 1);
  assert.equal(db.prepare('SELECT text FROM passages').get().text, 'second');
});

test('seq distinguishes multiple excerpts on the same range', () => {
  const db = openDb();
  upsertPassages(db, [row({ seq: 0 }), row({ seq: 1, text: 'other' })]);
  assert.equal(count(db), 2);
});

test('replacePassages removes only that commentary first', () => {
  const db = openDb();
  upsertPassages(db, [row(), row({ commentaryId: 'calvin' })]);
  replacePassages(db, 'gill', [row({ verseStart: 2, verseEnd: 2 })]);
  const rows = db.prepare('SELECT commentary_id AS c, verse_start AS v FROM passages ORDER BY c').all();
  assert.deepEqual(rows.map((r) => [r.c, r.v]), [['calvin', 1], ['gill', 2]]);
});

test('a failing batch rolls back', () => {
  const db = openDb();
  assert.throws(() => upsertPassages(db, [row(), row({ text: null })]));
  assert.equal(count(db), 0);
});

test('upsertSource inserts then updates', () => {
  const db = openDb();
  const s = { commentaryId: 'gill', name: 'Gill', author: 'John Gill', source: 'helloao', sourceUrl: 'u', license: 'PD', attribution: null, notes: null };
  upsertSource(db, s);
  upsertSource(db, { ...s, name: 'Gill v2' });
  const rows = db.prepare('SELECT name FROM sources').all();
  assert.deepEqual(rows.map((r) => r.name), ['Gill v2']);
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/db.js'`

- [ ] **Step 8: Implement `lib/db.js`**

```js
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  commentary_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  author TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  license TEXT NOT NULL,
  attribution TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS passages (
  commentary_id TEXT NOT NULL,
  source TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL,
  verse_end INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  license TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (commentary_id, book, chapter, verse_start, end_chapter, verse_end, seq)
);
CREATE INDEX IF NOT EXISTS idx_passages_book_chapter ON passages (book, chapter);
`;

const INSERT_PASSAGE = `
INSERT INTO passages
  (commentary_id, source, book, chapter, verse_start, end_chapter, verse_end, seq, text, license, fetched_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (commentary_id, book, chapter, verse_start, end_chapter, verse_end, seq)
DO UPDATE SET text = excluded.text, source = excluded.source,
              license = excluded.license, fetched_at = excluded.fetched_at`;

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

function inTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function insertRows(db, rows) {
  const stmt = db.prepare(INSERT_PASSAGE);
  for (const r of rows) {
    stmt.run(
      r.commentaryId, r.source, r.book, r.chapter, r.verseStart, r.endChapter,
      r.verseEnd, r.seq ?? 0, r.text, r.license, r.fetchedAt,
    );
  }
}

export function upsertPassages(db, rows) {
  inTransaction(db, () => insertRows(db, rows));
}

export function replacePassages(db, commentaryId, rows) {
  inTransaction(db, () => {
    db.prepare('DELETE FROM passages WHERE commentary_id = ?').run(commentaryId);
    insertRows(db, rows);
  });
}

export function upsertSource(db, s) {
  db.prepare(`
    INSERT INTO sources (commentary_id, name, author, source, source_url, license, attribution, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (commentary_id) DO UPDATE SET
      name = excluded.name, author = excluded.author, source = excluded.source,
      source_url = excluded.source_url, license = excluded.license,
      attribution = excluded.attribution, notes = excluded.notes`)
    .run(s.commentaryId, s.name, s.author ?? null, s.source, s.sourceUrl ?? null,
      s.license, s.attribution ?? null, s.notes ?? null);
}
```

- [ ] **Step 9: Run to verify all pass**

Run: `cd corpus && npm test`
Expected: all 9 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add corpus/
git commit -m "feat(corpus): scaffold package, book table, sqlite layer"
```

---

### Task 2: Polite fetcher

**Files:**
- Create: `corpus/lib/fetcher.js`
- Test: `corpus/test/fetcher.test.js`

**Interfaces:**
- Produces: `createFetcher({userAgent, minIntervalMs=200, hostIntervals={}, maxRetries=4, baseBackoffMs=1000, fetchImpl=fetch, sleep, now}) -> { fetch(url, {as='json'|'text'|'response'}) }`; `class HttpError(status, url)` with `.status`; `class BlockedError extends HttpError` (status 403)

- [ ] **Step 1: Write the failing test**

Create `corpus/test/fetcher.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/fetcher.js'`

- [ ] **Step 3: Implement `lib/fetcher.js`**

```js
export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

// 403 means the host is refusing automated access. We stop; we never work around it.
export class BlockedError extends HttpError {
  constructor(url) {
    super(403, url);
    this.name = 'BlockedError';
    this.message = `Blocked (403) by ${url}. Stopping; not attempting to work around access controls.`;
  }
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFetcher({
  userAgent,
  minIntervalMs = 200,
  hostIntervals = {},
  maxRetries = 4,
  baseBackoffMs = 1000,
  fetchImpl = globalThis.fetch,
  sleep = realSleep,
  now = Date.now,
}) {
  const nextSlot = new Map();

  // One shared limiter per host: each request reserves the next free slot,
  // so concurrent workers still send at most one request per interval.
  async function waitSlot(host) {
    const interval = hostIntervals[host] ?? minIntervalMs;
    const t = now();
    const slot = Math.max(t, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + interval);
    if (slot > t) await sleep(slot - t);
  }

  async function fetchUrl(url, { as = 'json' } = {}) {
    const host = new URL(url).host;
    for (let attempt = 0; ; attempt++) {
      await waitSlot(host);
      const res = await fetchImpl(url, { headers: { 'User-Agent': userAgent } });
      if (res.ok) {
        if (as === 'response') return res;
        return as === 'text' ? res.text() : res.json();
      }
      if (res.status === 403) throw new BlockedError(url);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) throw new HttpError(res.status, url);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * 2 ** attempt);
    }
  }

  return { fetch: fetchUrl };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (fetcher adds 9).

- [ ] **Step 5: Commit**

```bash
git add corpus/lib/fetcher.js corpus/test/fetcher.test.js
git commit -m "feat(corpus): polite fetcher with per-host limiter, backoff, stop-on-403"
```

---

### Task 3: HelloAO source

**Files:**
- Create: `corpus/lib/licenses.js`, `corpus/sources/helloao.js`
- Test: `corpus/test/helloao.test.js`

**Interfaces:**
- Consumes: `USFM_TO_CODE` (books.js); `upsertPassages`, `upsertSource` (db.js); `HttpError` (fetcher.js); a fetcher object with `fetch(url) -> parsed json`
- Produces:
  - `licenses.js`: `PD_MARK_URL`; `HELLOAO_COMMENTARIES: Record<helloaoId, {id, name, author, sectionLevel}>` for `john-calvin, matthew-henry, john-gill, jamieson-fausset-brown, adam-clarke`
  - `helloao.js`: `parseChapter(json, {sectionLevel}) -> {chapter, verseStart, verseEnd, text}[]`; `ingestHelloao(db, fetcher, {helloaoId, cacheDir, books, concurrency, baseUrl, now, log}) -> {chapters, rows, missing, skippedBooks}`

HelloAO facts (verified live 2026-09-20): `GET /api/c/{id}/books.json` returns `{commentary:{licenseUrl,...}, books:[{id, numberOfChapters,...}]}`; `GET /api/c/{id}/{BOOK}/{n}.json` returns `{book:{id}, chapter:{number, content:[{type:'verse', number, content:[string,...]}]}, numberOfVerses}`. Matthew Henry entries are sections keyed by their first verse.

- [ ] **Step 1: Create `lib/licenses.js`**

```js
export const PD_MARK_URL = 'https://creativecommons.org/publicdomain/mark/1.0/';

// Key = HelloAO commentary id. `id` is our stable commentary_id.
// sectionLevel: entries are keyed by their first verse and run until the next entry.
export const HELLOAO_COMMENTARIES = {
  'john-calvin': { id: 'calvin', name: "Calvin's Commentaries", author: 'John Calvin', sectionLevel: false },
  'matthew-henry': { id: 'henry', name: 'Matthew Henry Commentary', author: 'Matthew Henry', sectionLevel: true },
  'john-gill': { id: 'gill', name: "Gill's Exposition of the Bible", author: 'John Gill', sectionLevel: false },
  'jamieson-fausset-brown': { id: 'jfb', name: 'Jamieson-Fausset-Brown Commentary', author: 'Jamieson, Fausset, Brown', sectionLevel: false },
  'adam-clarke': { id: 'clarke', name: "Clarke's Commentary", author: 'Adam Clarke', sectionLevel: false },
};

// Only these HCF authors are ingested: the HCF LICENSE says the database also holds
// copyrighted fair-use excerpts, so we allowlist authors instead of taking everything.
export const HCF_AUTHORS = {
  'Cornelius a Lapide': { id: 'lapide', name: "Lapide's Commentary", author: 'Cornelius a Lapide' },
  'John Wesley': { id: 'wesley', name: "Wesley's Notes (HCF excerpts)", author: 'John Wesley' },
  'Martin Luther': { id: 'luther', name: "Luther's Commentary (HCF excerpts)", author: 'Martin Luther' },
};

export const HCF_LICENSE =
  'Public-domain dedication (compilation); public-domain authors only (allowlist), fair-use excerpts excluded';
```

- [ ] **Step 2: Write the failing test**

Create `corpus/test/helloao.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';
import { HttpError, BlockedError } from '../lib/fetcher.js';
import { PD_MARK_URL } from '../lib/licenses.js';
import { parseChapter, ingestHelloao } from '../sources/helloao.js';

const verse = (number, ...content) => ({ type: 'verse', number, content });

test('parseChapter: verse-level entries keep their own verse number', () => {
  const json = { numberOfVerses: 5, chapter: { number: 1, content: [verse(1, 'a', 'b'), verse(3, 'c')] } };
  assert.deepEqual(parseChapter(json), [
    { chapter: 1, verseStart: 1, verseEnd: 1, text: 'a\n\nb' },
    { chapter: 1, verseStart: 3, verseEnd: 3, text: 'c' },
  ]);
});

test('parseChapter: sectionLevel runs each entry to the next start, last to chapter end', () => {
  const json = { numberOfVerses: 5, chapter: { number: 1, content: [verse(1, 'a'), verse(3, 'c')] } };
  assert.deepEqual(parseChapter(json, { sectionLevel: true }), [
    { chapter: 1, verseStart: 1, verseEnd: 2, text: 'a' },
    { chapter: 1, verseStart: 3, verseEnd: 5, text: 'c' },
  ]);
});

test('parseChapter: drops empty text, non-string parts and non-verse entries', () => {
  const json = {
    numberOfVerses: 3,
    chapter: { number: 2, content: [{ type: 'heading', content: ['H'] }, verse(1, '   '), verse(2, { x: 1 }), verse(3, 'ok')] },
  };
  assert.deepEqual(parseChapter(json), [{ chapter: 2, verseStart: 3, verseEnd: 3, text: 'ok' }]);
});

// ---- ingest ----

function fakeFetcher(files) {
  const calls = [];
  return {
    calls,
    async fetch(url) {
      calls.push(url);
      if (!(url in files)) throw new HttpError(404, url);
      const v = files[url];
      if (v instanceof Error) throw v;
      return v;
    },
  };
}

const BASE = 'https://h.example';
const chapterJson = (book, n, verses) => ({
  book: { id: book }, numberOfVerses: 10, chapter: { number: n, content: verses },
});
const booksJson = (licenseUrl = PD_MARK_URL) => ({
  commentary: { id: 'john-gill', licenseUrl },
  books: [
    { id: 'ROM', numberOfChapters: 2 },
    { id: 'XXX', numberOfChapters: 1 },
  ],
});

async function tmp() { return fs.mkdtemp(path.join(os.tmpdir(), 'corpus-helloao-')); }
const rowCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM passages').get().n;

test('ingest writes rows, skips unknown books, counts missing chapters', async () => {
  const db = openDb();
  const fetcher = fakeFetcher({
    [`${BASE}/api/c/john-gill/books.json`]: booksJson(),
    [`${BASE}/api/c/john-gill/ROM/1.json`]: chapterJson('ROM', 1, [verse(1, 'one'), verse(2, 'two')]),
    // ROM/2.json intentionally absent -> 404
  });
  const stats = await ingestHelloao(db, fetcher, { helloaoId: 'john-gill', cacheDir: await tmp(), baseUrl: BASE });
  assert.deepEqual(stats, { chapters: 1, rows: 2, missing: 1, skippedBooks: ['XXX'] });
  const r = db.prepare('SELECT commentary_id, book, chapter, verse_start, text, license FROM passages ORDER BY verse_start').all();
  assert.equal(r.length, 2);
  assert.deepEqual({ ...r[0] }, { commentary_id: 'gill', book: 'rom', chapter: 1, verse_start: 1, text: 'one', license: PD_MARK_URL });
  assert.equal(db.prepare('SELECT license FROM sources WHERE commentary_id = ?').get('gill').license, PD_MARK_URL);
});

test('second run is served from the cache and row count is unchanged', async () => {
  const db = openDb();
  const cacheDir = await tmp();
  const files = {
    [`${BASE}/api/c/john-gill/books.json`]: booksJson(),
    [`${BASE}/api/c/john-gill/ROM/1.json`]: chapterJson('ROM', 1, [verse(1, 'one')]),
    [`${BASE}/api/c/john-gill/ROM/2.json`]: chapterJson('ROM', 2, [verse(1, 'two')]),
  };
  const f1 = fakeFetcher(files);
  await ingestHelloao(db, f1, { helloaoId: 'john-gill', cacheDir, baseUrl: BASE });
  const f2 = fakeFetcher(files);
  await ingestHelloao(db, f2, { helloaoId: 'john-gill', cacheDir, baseUrl: BASE });
  assert.equal(rowCount(db), 2);
  assert.deepEqual(f2.calls, [`${BASE}/api/c/john-gill/books.json`]); // only the index is refetched
});

test('books filter limits which books are fetched', async () => {
  const db = openDb();
  const fetcher = fakeFetcher({
    [`${BASE}/api/c/john-gill/books.json`]: booksJson(),
    [`${BASE}/api/c/john-gill/ROM/1.json`]: chapterJson('ROM', 1, [verse(1, 'one')]),
  });
  await ingestHelloao(db, fetcher, { helloaoId: 'john-gill', cacheDir: await tmp(), baseUrl: BASE, books: ['XXX'] });
  assert.equal(rowCount(db), 0);
  assert.equal(fetcher.calls.length, 1);
});

test('refuses a commentary whose license is not the Public Domain Mark', async () => {
  const db = openDb();
  const fetcher = fakeFetcher({ [`${BASE}/api/c/john-gill/books.json`]: booksJson('https://example.com/cc-by-sa') });
  await assert.rejects(
    ingestHelloao(db, fetcher, { helloaoId: 'john-gill', cacheDir: await tmp(), baseUrl: BASE }),
    /unexpected license/,
  );
  assert.equal(rowCount(db), 0);
});

test('a 403 aborts the run', async () => {
  const db = openDb();
  const fetcher = fakeFetcher({
    [`${BASE}/api/c/john-gill/books.json`]: booksJson(),
    [`${BASE}/api/c/john-gill/ROM/1.json`]: new BlockedError(`${BASE}/api/c/john-gill/ROM/1.json`),
  });
  await assert.rejects(
    ingestHelloao(db, fetcher, { helloaoId: 'john-gill', cacheDir: await tmp(), baseUrl: BASE, concurrency: 1 }),
    BlockedError,
  );
});

test('unknown commentary id is rejected', async () => {
  await assert.rejects(
    ingestHelloao(openDb(), fakeFetcher({}), { helloaoId: 'nope', cacheDir: await tmp(), baseUrl: BASE }),
    /Unknown HelloAO commentary/,
  );
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../sources/helloao.js'`

- [ ] **Step 4: Implement `sources/helloao.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { USFM_TO_CODE } from '../lib/books.js';
import { upsertPassages, upsertSource } from '../lib/db.js';
import { HttpError } from '../lib/fetcher.js';
import { HELLOAO_COMMENTARIES, PD_MARK_URL } from '../lib/licenses.js';

const DEFAULT_BASE = 'https://bible.helloao.org';

export function parseChapter(json, { sectionLevel = false } = {}) {
  const chapter = json.chapter.number;
  const verses = json.chapter.content.filter((c) => c.type === 'verse');
  const rows = [];
  verses.forEach((v, i) => {
    const text = v.content.filter((p) => typeof p === 'string').join('\n\n').trim();
    if (!text) return;
    const next = verses[i + 1];
    const end = sectionLevel ? (next ? next.number - 1 : json.numberOfVerses) : v.number;
    rows.push({ chapter, verseStart: v.number, verseEnd: Math.max(end, v.number), text });
  });
  return rows;
}

async function readCached(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function ingestHelloao(db, fetcher, opts) {
  const {
    helloaoId, cacheDir, books = null, concurrency = 2, baseUrl = DEFAULT_BASE,
    now = () => new Date().toISOString(), log = () => {},
  } = opts;
  const meta = HELLOAO_COMMENTARIES[helloaoId];
  if (!meta) throw new Error(`Unknown HelloAO commentary: ${helloaoId}`);

  const index = await fetcher.fetch(`${baseUrl}/api/c/${helloaoId}/books.json`);
  const licenseUrl = index.commentary.licenseUrl;
  if (licenseUrl !== PD_MARK_URL) {
    throw new Error(`Refusing ${helloaoId}: unexpected license ${licenseUrl}`);
  }
  upsertSource(db, {
    commentaryId: meta.id, name: meta.name, author: meta.author, source: 'helloao',
    sourceUrl: `${baseUrl}/api/c/${helloaoId}/books.json`, license: licenseUrl,
    attribution: 'HelloAO Free Use Bible API', notes: meta.sectionLevel ? 'section-level entries' : null,
  });

  const tasks = [];
  const skippedBooks = [];
  for (const b of index.books) {
    if (books && !books.includes(b.id)) continue;
    if (!USFM_TO_CODE[b.id]) { skippedBooks.push(b.id); continue; }
    for (let ch = 1; ch <= b.numberOfChapters; ch++) tasks.push({ usfm: b.id, ch });
  }

  const stats = { chapters: 0, rows: 0, missing: 0, skippedBooks };
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const { usfm, ch } = tasks[next++];
      const file = path.join(cacheDir, helloaoId, usfm, `${ch}.json`);
      let json = await readCached(file);
      if (!json) {
        try {
          json = await fetcher.fetch(`${baseUrl}/api/c/${helloaoId}/${usfm}/${ch}.json`);
        } catch (err) {
          if (err instanceof HttpError && err.status === 404) { stats.missing++; continue; }
          throw err;
        }
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(json));
      }
      const parsed = parseChapter(json, { sectionLevel: meta.sectionLevel });
      upsertPassages(db, parsed.map((p) => ({
        commentaryId: meta.id, source: 'helloao', book: USFM_TO_CODE[usfm],
        chapter: p.chapter, verseStart: p.verseStart, endChapter: p.chapter, verseEnd: p.verseEnd,
        text: p.text, license: licenseUrl, fetchedAt: now(),
      })));
      stats.chapters++;
      stats.rows += parsed.length;
      log(`${meta.id} ${usfm} ${ch}: ${parsed.length} rows`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return stats;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (helloao adds 9).

- [ ] **Step 6: Commit**

```bash
git add corpus/lib/licenses.js corpus/sources/helloao.js corpus/test/helloao.test.js
git commit -m "feat(corpus): HelloAO source with license guard, cache, worker pool"
```

---

### Task 4: HistoricalChristianFaith source

**Files:**
- Create: `corpus/sources/hcf.js`
- Test: `corpus/test/hcf.test.js`

**Interfaces:**
- Consumes: `HCF_NAME_TO_CODE` (books.js); `replacePassages`, `upsertSource` (db.js); `HCF_AUTHORS`, `HCF_LICENSE` (licenses.js); fetcher `fetch(url, {as:'response'})`
- Produces: `HCF_RELEASE_URL`; `downloadRelease(fetcher, destPath) -> Promise<void>` (skips if `destPath` exists); `ingestHcf(db, hcfSqlitePath, {now}) -> {rows, skippedBooks, perCommentary}`

HCF facts (verified live 2026-09-20): release asset `commentaries.sqlite` (~160 MB). Table `commentary(id, father_name, file_name, append_to_author_name, ts, book, location_start, location_end, txt, source_url, source_title)`. `book` is the English name lowercased with spaces removed. Locations are encoded `chapter * 1000000 + verse`.

- [ ] **Step 1: Write the failing test**

Create `corpus/test/hcf.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../lib/db.js';
import { HCF_LICENSE } from '../lib/licenses.js';
import { ingestHcf, downloadRelease } from '../sources/hcf.js';

async function fixture(rows) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'corpus-hcf-'));
  const file = path.join(dir, 'commentaries.sqlite');
  const src = new DatabaseSync(file);
  src.exec(`CREATE TABLE commentary (
    id VARCHAR, father_name VARCHAR, file_name VARCHAR, append_to_author_name VARCHAR,
    ts INTEGER, book VARCHAR, location_start INTEGER, location_end INTEGER,
    txt TEXT, source_url VARCHAR, source_title VARCHAR)`);
  const ins = src.prepare('INSERT INTO commentary (id, father_name, book, location_start, location_end, txt) VALUES (?,?,?,?,?,?)');
  rows.forEach((r, i) => ins.run(`id${i}`, ...r));
  src.close();
  return file;
}

const ROWS = [
  ['Cornelius a Lapide', 'romans', 1000005, 1000007, 'lapide text'],
  ['John Wesley', 'songofsolomon', 2000001, 2000001, 'wesley text'],
  ['Martin Luther', 'matthew', 1000057, 2000032, 'cross-chapter'],
  ['Martin Luther', 'matthew', 1000057, 2000032, 'second excerpt same range'],
  ['Augustine of Hippo', 'romans', 1000001, 1000001, 'excluded author'],
  ['John Wesley', 'tobit', 1000001, 1000001, 'unknown book'],
  ['John Wesley', 'romans', 3000001, 3000001, '   '],
];

const all = (db) => db.prepare(
  'SELECT commentary_id AS c, book, chapter, verse_start AS vs, end_chapter AS ec, verse_end AS ve, seq, text FROM passages ORDER BY c, book, seq',
).all().map((r) => ({ ...r }));

test('ingestHcf keeps allowlisted authors and decodes locations', async () => {
  const db = openDb();
  const stats = await ingestHcf(db, await fixture(ROWS), { now: () => 'T' });
  assert.deepEqual(all(db), [
    { c: 'lapide', book: 'rom', chapter: 1, vs: 5, ec: 1, ve: 7, seq: 0, text: 'lapide text' },
    { c: 'luther', book: 'mat', chapter: 1, vs: 57, ec: 2, ve: 32, seq: 0, text: 'cross-chapter' },
    { c: 'luther', book: 'mat', chapter: 1, vs: 57, ec: 2, ve: 32, seq: 1, text: 'second excerpt same range' },
    { c: 'wesley', book: 'sng', chapter: 2, vs: 1, ec: 2, ve: 1, seq: 0, text: 'wesley text' },
  ]);
  assert.equal(stats.rows, 4);
  assert.equal(stats.skippedBooks, 1);
  assert.equal(db.prepare('SELECT license FROM sources WHERE commentary_id = ?').get('lapide').license, HCF_LICENSE);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM passages WHERE license != ?").get(HCF_LICENSE).n, 0);
});

test('ingestHcf is idempotent (replace, not append)', async () => {
  const db = openDb();
  const file = await fixture(ROWS);
  await ingestHcf(db, file);
  await ingestHcf(db, file);
  assert.equal(all(db).length, 4);
});

test('downloadRelease skips when the file already exists', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'corpus-hcf-dl-'));
  const dest = path.join(dir, 'commentaries.sqlite');
  await fs.writeFile(dest, 'existing');
  const fetcher = { fetch: async () => { throw new Error('should not fetch'); } };
  await downloadRelease(fetcher, dest);
  assert.equal(await fs.readFile(dest, 'utf8'), 'existing');
});

test('downloadRelease streams the response body to disk', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'corpus-hcf-dl-'));
  const dest = path.join(dir, 'nested', 'commentaries.sqlite');
  const body = new Response('hello sqlite').body;
  const fetcher = { fetch: async () => ({ body }) };
  await downloadRelease(fetcher, dest);
  assert.equal(await fs.readFile(dest, 'utf8'), 'hello sqlite');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../sources/hcf.js'`

- [ ] **Step 3: Implement `sources/hcf.js`**

```js
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';
import { HCF_NAME_TO_CODE } from '../lib/books.js';
import { replacePassages, upsertSource } from '../lib/db.js';
import { HCF_AUTHORS, HCF_LICENSE } from '../lib/licenses.js';

export const HCF_RELEASE_URL =
  'https://github.com/HistoricalChristianFaith/Commentaries-Database/releases/download/latest/commentaries.sqlite';

export async function downloadRelease(fetcher, destPath) {
  if (fs.existsSync(destPath)) return;
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  const res = await fetcher.fetch(HCF_RELEASE_URL, { as: 'response' });
  const partial = `${destPath}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
  await fsp.rename(partial, destPath);
}

export async function ingestHcf(db, hcfPath, { now = () => new Date().toISOString() } = {}) {
  const src = new DatabaseSync(hcfPath, { readOnly: true });
  try {
    const authors = Object.keys(HCF_AUTHORS);
    const found = src.prepare(
      `SELECT father_name, book, location_start, location_end, txt FROM commentary
       WHERE father_name IN (${authors.map(() => '?').join(',')}) ORDER BY rowid`,
    ).all(...authors);

    const byId = new Map(Object.values(HCF_AUTHORS).map((a) => [a.id, []]));
    const seen = new Map();
    let skippedBooks = 0;
    const fetchedAt = now();

    for (const r of found) {
      const code = HCF_NAME_TO_CODE[r.book];
      if (!code) { skippedBooks++; continue; }
      const text = (r.txt ?? '').trim();
      if (!text) continue;
      const meta = HCF_AUTHORS[r.father_name];
      const chapter = Math.floor(r.location_start / 1e6);
      const verseStart = r.location_start % 1e6;
      const endChapter = Math.floor(r.location_end / 1e6);
      const verseEnd = r.location_end % 1e6;
      const key = [meta.id, code, chapter, verseStart, endChapter, verseEnd].join('|');
      const seq = seen.get(key) ?? 0;
      seen.set(key, seq + 1);
      byId.get(meta.id).push({
        commentaryId: meta.id, source: 'hcf', book: code, chapter, verseStart, endChapter,
        verseEnd, seq, text, license: HCF_LICENSE, fetchedAt,
      });
    }

    const perCommentary = {};
    for (const meta of Object.values(HCF_AUTHORS)) {
      const rows = byId.get(meta.id);
      upsertSource(db, {
        commentaryId: meta.id, name: meta.name, author: meta.author, source: 'hcf',
        sourceUrl: 'https://github.com/HistoricalChristianFaith/Commentaries-Database',
        license: HCF_LICENSE, attribution: 'HistoricalChristianFaith/Commentaries-Database',
        notes: 'excerpts, not the complete work',
      });
      replacePassages(db, meta.id, rows);
      perCommentary[meta.id] = rows.length;
    }
    return { rows: Object.values(perCommentary).reduce((a, b) => a + b, 0), skippedBooks, perCommentary };
  } finally {
    src.close();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (hcf adds 4). If `readOnly` is rejected by this Node version, replace the constructor call with `new DatabaseSync(hcfPath)`; nothing in this function writes to it.

- [ ] **Step 5: Commit**

```bash
git add corpus/sources/hcf.js corpus/test/hcf.test.js
git commit -m "feat(corpus): HCF source with author allowlist and streamed download"
```

---

### Task 5: Coverage report, CLI, README, live smoke test

**Files:**
- Create: `corpus/lib/report.js`, `corpus/cli.js`, `corpus/README.md`
- Test: `corpus/test/report.test.js`

**Interfaces:**
- Consumes: `bibleBounds` from `../../backend/services/bibleBounds.js`; everything produced by Tasks 1-4
- Produces: `coverage(db) -> Record<commentaryId, {chaptersHave, chaptersTotal, missingBooks: string[], partialBooks: {book, have, total}[]}>` (a chapter counts as covered if any row starts in it); `formatReport(db) -> string`

- [ ] **Step 1: Write the failing test**

Create `corpus/test/report.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertSource, upsertPassages } from '../lib/db.js';
import { coverage, formatReport } from '../lib/report.js';
import { bibleBounds } from '../../backend/services/bibleBounds.js';

function seeded() {
  const db = openDb();
  upsertSource(db, { commentaryId: 'x', name: 'X', author: 'A', source: 'helloao', sourceUrl: null, license: 'PD-LICENSE' });
  upsertPassages(db, [1, 2, 3].map((chapter) => ({
    commentaryId: 'x', source: 'helloao', book: 'gen', chapter, verseStart: 1, endChapter: chapter,
    verseEnd: 1, text: 't', license: 'PD-LICENSE', fetchedAt: 'T',
  })));
  return db;
}

test('coverage counts covered chapters and lists partial and missing books', () => {
  const total = Object.values(bibleBounds).reduce((n, b) => n + b.chapters, 0);
  const c = coverage(seeded()).x;
  assert.equal(c.chaptersHave, 3);
  assert.equal(c.chaptersTotal, total);
  assert.deepEqual(c.partialBooks, [{ book: 'gen', have: 3, total: bibleBounds.gen.chapters }]);
  assert.ok(c.missingBooks.includes('exo'));
  assert.ok(!c.missingBooks.includes('gen'));
});

test('formatReport shows coverage and the license list', () => {
  const text = formatReport(seeded());
  assert.match(text, /x: 3\/\d+ chapters/);
  assert.match(text, /PD-LICENSE/);
  assert.match(text, /gen 3\/50/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/report.js'`

- [ ] **Step 3: Implement `lib/report.js`**

```js
import { bibleBounds } from '../../backend/services/bibleBounds.js';

export function coverage(db) {
  const ids = db.prepare('SELECT commentary_id FROM sources ORDER BY commentary_id').all().map((r) => r.commentary_id);
  const out = {};
  for (const id of ids) {
    const have = new Map(
      db.prepare('SELECT book, COUNT(DISTINCT chapter) AS n FROM passages WHERE commentary_id = ? GROUP BY book')
        .all(id).map((r) => [r.book, r.n]),
    );
    let chaptersHave = 0;
    let chaptersTotal = 0;
    const missingBooks = [];
    const partialBooks = [];
    for (const [code, b] of Object.entries(bibleBounds)) {
      const n = Math.min(have.get(code) ?? 0, b.chapters);
      chaptersTotal += b.chapters;
      chaptersHave += n;
      if (n === 0) missingBooks.push(code);
      else if (n < b.chapters) partialBooks.push({ book: code, have: n, total: b.chapters });
    }
    out[id] = { chaptersHave, chaptersTotal, missingBooks, partialBooks };
  }
  return out;
}

export function formatReport(db) {
  const lines = ['Coverage'];
  for (const [id, c] of Object.entries(coverage(db))) {
    lines.push(`${id}: ${c.chaptersHave}/${c.chaptersTotal} chapters; ${c.missingBooks.length} books missing, ${c.partialBooks.length} partial`);
    if (c.missingBooks.length) lines.push(`  missing: ${c.missingBooks.join(' ')}`);
    if (c.partialBooks.length) lines.push(`  partial: ${c.partialBooks.map((p) => `${p.book} ${p.have}/${p.total}`).join(', ')}`);
  }
  lines.push('', 'Sources and licenses');
  for (const s of db.prepare('SELECT commentary_id, source, license FROM sources ORDER BY commentary_id').all()) {
    lines.push(`${s.commentary_id}  [${s.source}]  ${s.license}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (report adds 2).

- [ ] **Step 5: Implement `cli.js`**

```js
#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { openDb } from './lib/db.js';
import { BlockedError, createFetcher } from './lib/fetcher.js';
import { HELLOAO_COMMENTARIES } from './lib/licenses.js';
import { formatReport } from './lib/report.js';
import { downloadRelease, ingestHcf } from './sources/hcf.js';
import { ingestHelloao } from './sources/helloao.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: path.join(here, 'corpus.sqlite') },
    commentary: { type: 'string' },
    book: { type: 'string', multiple: true },
    concurrency: { type: 'string', default: '2' },
  },
});
const [command, source] = positionals;

function makeFetcher(minIntervalMs) {
  const contact = process.env.CORPUS_CONTACT;
  if (!contact) {
    console.error('Set CORPUS_CONTACT to an email or URL so servers can reach you (it goes in the User-Agent).');
    process.exit(2);
  }
  return createFetcher({
    userAgent: `bible-commentary-corpus/0.1 (research; contact: ${contact})`,
    minIntervalMs,
  });
}

async function main() {
  if (command === 'report') {
    console.log(formatReport(openDb(values.db)));
    return;
  }
  if (command === 'ingest' && source === 'helloao') {
    const db = openDb(values.db);
    const fetcher = makeFetcher(200); // <= 5 req/s across all workers
    const ids = values.commentary ? [values.commentary] : Object.keys(HELLOAO_COMMENTARIES);
    for (const helloaoId of ids) {
      const stats = await ingestHelloao(db, fetcher, {
        helloaoId, cacheDir: path.join(here, 'cache', 'helloao'), books: values.book ?? null,
        concurrency: Number(values.concurrency), log: (m) => console.error(m),
      });
      console.log(helloaoId, JSON.stringify(stats));
    }
    return;
  }
  if (command === 'ingest' && source === 'hcf') {
    const db = openDb(values.db);
    const dest = path.join(here, 'cache', 'hcf', 'commentaries.sqlite');
    await downloadRelease(makeFetcher(1000), dest);
    console.log('hcf', JSON.stringify(await ingestHcf(db, dest)));
    return;
  }
  console.error('Usage: cli.js ingest helloao [--commentary <helloao-id>] [--book ROM ...] | ingest hcf | report  [--db path]');
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof BlockedError ? err.message : err);
  process.exit(err instanceof BlockedError ? 3 : 1);
});
```

- [ ] **Step 6: Create `corpus/README.md`**

````markdown
# Commentary research corpus

Builds a local sqlite corpus of public-domain Bible commentaries from sources that
support bulk use (HelloAO, HistoricalChristianFaith). It never contacts StudyLight.org
and never disguises itself: requests carry an honest User-Agent, are rate limited per
host, back off on 429/5xx, and stop on 403.

Requires Node >= 22.13. No npm dependencies.

```bash
cd corpus
export CORPUS_CONTACT=you@example.com        # goes in the User-Agent
npm run ingest -- helloao                    # Calvin, Henry, Gill, JFB, Clarke
npm run ingest -- helloao --commentary john-gill --book ROM   # one book
npm run ingest -- hcf                        # Lapide, Wesley, Luther (excerpts; ~160 MB download)
npm run report                               # coverage gaps + licenses
npm test
```

Output: `corpus.sqlite` (tables `passages`, `sources`). Raw downloads are cached under `cache/`
and reruns skip anything already downloaded. Both files are gitignored.

Not included yet: SWORD modules (Barnes, etc.), Benson, Whedon, Darby, Kretzmann, Bengel,
Haydock. The copyrighted commentaries (Scofield, Ironside, McGee, Constable, Orchard) are out of scope.
````

- [ ] **Step 7: Verify the CLI wiring offline**

Run: `cd corpus && CORPUS_CONTACT= node --disable-warning=ExperimentalWarning cli.js ingest helloao; echo "exit=$?"`
Expected: prints the `Set CORPUS_CONTACT...` message, `exit=2`.

Run: `cd corpus && node --disable-warning=ExperimentalWarning cli.js report --db /tmp/none.sqlite`
Expected: prints `Coverage` and `Sources and licenses` headings with no rows, exit 0. (Use the session scratchpad instead of `/tmp` if running under the harness.)

- [ ] **Step 8: Live smoke test (small, polite, one book)**

Run: `cd corpus && CORPUS_CONTACT=<your email> npm run ingest -- helloao --commentary matthew-henry --book ROM`
Expected: one line like `matthew-henry {"chapters":16,"rows":<n>,"missing":0,"skippedBooks":[]}`. Then verify section-level ranges:

Run: `cd corpus && node --disable-warning=ExperimentalWarning -e "import('./lib/db.js').then(({openDb})=>{const d=openDb('corpus.sqlite');console.log(d.prepare(\"SELECT chapter, verse_start, verse_end FROM passages WHERE commentary_id='henry' AND book='rom' AND chapter=1 ORDER BY verse_start\").all())})"`
Expected: ascending, non-overlapping ranges that end at the chapter's last verse (Romans 1 has 32 verses). If Henry rows all have `verse_start` of 1 or `undefined`, HelloAO's Henry entries use a different field than `number`; inspect one cached file under `cache/helloao/matthew-henry/ROM/1.json` and adjust `parseChapter` and its test.

Then a second run must be fully cached: run the same command again and confirm it prints the same stats with no network chapter requests (only `books.json` is refetched).

- [ ] **Step 9: Full ingest and report**

Run: `cd corpus && CORPUS_CONTACT=<your email> npm run ingest -- helloao` then `npm run ingest -- hcf` then `npm run report`
Expected: no 403s. If any run aborts with `Blocked (403)`, stop; do not retry or change headers. Record the gaps the report shows (Henry section-level, Clarke short of 66 books, Luther partial) in the README's "Not included yet" list.

- [ ] **Step 10: Run the full suite and commit**

Run: `cd corpus && npm test`
Expected: all tests PASS.

```bash
git add corpus/lib/report.js corpus/cli.js corpus/README.md corpus/test/report.test.js
git commit -m "feat(corpus): coverage report, CLI, README"
```

---

## Self-Review Notes

- **Spec coverage:** standalone package (Task 1); honest UA, per-host limiter, backoff, stop-on-403 (Task 2); HelloAO + license guard + cache + worker pool (Task 3); HCF with author allowlist (Task 4); `report` with gaps vs `bibleBounds` and license list, CLI, resumability (Task 5). Explicitly deferred: SWORD, Phase 2 gap probe.
- **Placeholders:** none; the only bracketed value is the user's own contact email, supplied at run time via `CORPUS_CONTACT`.
- **Type consistency:** row shape `{commentaryId, source, book, chapter, verseStart, endChapter, verseEnd, seq?, text, license, fetchedAt}` is identical in `db.js`, `helloao.js`, `hcf.js` and the tests; `parseChapter` returns `{chapter, verseStart, verseEnd, text}` and `ingestHelloao` maps it to the full row.
