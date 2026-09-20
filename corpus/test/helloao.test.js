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

test('non-positive-integer concurrency is rejected', async () => {
  for (const concurrency of [0, NaN, -1, 1.5]) {
    await assert.rejects(
      ingestHelloao(openDb(), fakeFetcher({}), { helloaoId: 'john-gill', cacheDir: await tmp(), baseUrl: BASE, concurrency }),
      /concurrency must be a positive integer/,
    );
  }
});

test('parseChapter: sectionLevel without numberOfVerses falls back to the entry verse', () => {
  const json = { chapter: { number: 1, content: [verse(1, 'a'), verse(3, 'c')] } };
  assert.deepEqual(parseChapter(json, { sectionLevel: true }), [
    { chapter: 1, verseStart: 1, verseEnd: 2, text: 'a' },
    { chapter: 1, verseStart: 3, verseEnd: 3, text: 'c' },
  ]);
});
