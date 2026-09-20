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
