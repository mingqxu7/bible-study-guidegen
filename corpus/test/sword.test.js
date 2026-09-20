import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';
import { slotCount, verseSlot as s } from '../lib/kjv.js';
import { ingestSword } from '../sources/sword.js';
import { buildModuleZip, buildTestament } from './helpers/sword-fixtures.js';
import { buildZip } from './helpers/zip-builder.js';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'corpus-sword-'));
const rows = (db) => db.prepare(
  'SELECT commentary_id AS c, book, chapter, verse_start AS vs, end_chapter AS ec, verse_end AS ve, text, license, source FROM passages ORDER BY book, chapter, verse_start',
).all().map((r) => ({ ...r }));

function fakeFetcher(zipBuf) {
  const calls = [];
  return {
    calls,
    async fetch(url, opts) {
      calls.push([url, opts]);
      return { body: new Response(zipBuf).body };
    },
  };
}

const wesleyZip = () => buildModuleZip({
  id: 'Wesley',
  ot: [
    { slots: [s('gen', 1, 1)], text: '<p>Alpha</p>' },
    { slots: [s('gen', 1, 2), s('gen', 1, 3)], text: 'Beta<br />line two' },
  ],
  nt: [{ slots: [s('mat', 1, 1)], text: 'Gamma &amp; delta' }],
});

test('ingests both testaments, groups shared notes, cleans markup, records license and source', async () => {
  const db = openDb();
  const fetcher = fakeFetcher(wesleyZip());
  const stats = await ingestSword(db, fetcher, { moduleId: 'Wesley', cacheDir: await tmp(), now: () => 'T' });
  assert.deepEqual(stats, { testaments: ['ot', 'nt'], books: 2, rows: 3 });
  assert.deepEqual(rows(db), [
    { c: 'wesley', book: 'gen', chapter: 1, vs: 1, ec: 1, ve: 1, text: 'Alpha', license: 'Public Domain', source: 'sword' },
    { c: 'wesley', book: 'gen', chapter: 1, vs: 2, ec: 1, ve: 3, text: 'Beta\nline two', license: 'Public Domain', source: 'sword' },
    { c: 'wesley', book: 'mat', chapter: 1, vs: 1, ec: 1, ve: 1, text: 'Gamma & delta', license: 'Public Domain', source: 'sword' },
  ]);
  const src = db.prepare('SELECT name, license, source, source_url FROM sources WHERE commentary_id = ?').get('wesley');
  assert.equal(src.license, 'Public Domain');
  assert.equal(src.source, 'sword');
  assert.equal(src.source_url, 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Wesley.zip');
  assert.equal(fetcher.calls[0][1].as, 'response');
});

test('second run is served from the cached ZIP and leaves the same rows', async () => {
  const db = openDb();
  const fetcher = fakeFetcher(wesleyZip());
  const cacheDir = await tmp();
  await ingestSword(db, fetcher, { moduleId: 'Wesley', cacheDir });
  const first = rows(db);
  await ingestSword(db, fetcher, { moduleId: 'Wesley', cacheDir });
  assert.equal(fetcher.calls.length, 1);
  assert.deepEqual(rows(db), first);
});

test('a rerun replaces the module rows instead of leaving stale ones', async () => {
  const db = openDb();
  const cacheDir = await tmp();
  await ingestSword(db, fakeFetcher(wesleyZip()), { moduleId: 'Wesley', cacheDir });
  await fs.rm(path.join(cacheDir, 'Wesley.zip'));
  const smaller = buildModuleZip({ id: 'Wesley', ot: [{ slots: [s('gen', 1, 1)], text: 'Only' }] });
  await ingestSword(db, fakeFetcher(smaller), { moduleId: 'Wesley', cacheDir });
  assert.deepEqual(rows(db).map((r) => [r.book, r.vs, r.text]), [['gen', 1, 'Only']]);
});

test('Barnes: NT-only module, "no text" stubs dropped, BlockType CHAPTER read from .cz files', async () => {
  const db = openDb();
  const zip = buildModuleZip({
    id: 'Barnes', blockType: 'CHAPTER',
    nt: [
      { slots: [s('mat', 1, 4)], text: 'Verse 4. No specific Barnes text on this verse. <scripRef passage="Mt 1:3">Mt 1:3</scripRef>.' },
      { slots: [s('mat', 1, 5)], text: 'A real Barnes note' },
    ],
  });
  const stats = await ingestSword(db, fakeFetcher(zip), { moduleId: 'Barnes', cacheDir: await tmp() });
  assert.deepEqual(stats, { testaments: ['nt'], books: 1, rows: 1 });
  assert.deepEqual(rows(db).map((r) => [r.c, r.book, r.vs, r.text]), [['barnes', 'mat', 5, 'A real Barnes note']]);
  assert.equal(db.prepare('SELECT notes FROM sources WHERE commentary_id = ?').get('barnes').notes, 'New Testament only');
});

test('Luther: a note spanning chapters becomes one row with end_chapter', async () => {
  const db = openDb();
  const zip = buildModuleZip({
    id: 'Luther', blockType: 'CHAPTER', conf: { SourceType: 'OSIS' },
    ot: [{ slots: [s('gen', 1, 31), s('gen', 2, 1), s('gen', 2, 2)], text: '<div sID="a"/>Long note<div eID="a"/>' }],
  });
  await ingestSword(db, fakeFetcher(zip), { moduleId: 'Luther', cacheDir: await tmp() });
  assert.deepEqual(rows(db).map((r) => [r.chapter, r.vs, r.ec, r.ve, r.text]), [[1, 31, 2, 2, 'Long note']]);
});

test('refuses a module that is not public domain before writing anything', async () => {
  const db = openDb();
  const zip = buildModuleZip({ id: 'Wesley', ot: [{ slots: [s('gen', 1, 1)], text: 'x' }], conf: { DistributionLicense: 'Copyrighted' } });
  await assert.rejects(ingestSword(db, fakeFetcher(zip), { moduleId: 'Wesley', cacheDir: await tmp() }), /Refusing Wesley.*Public Domain/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM passages').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sources').get().n, 0);
});

test('a corrupt cached ZIP tells you which file to delete', async () => {
  const cacheDir = await tmp();
  await fs.writeFile(path.join(cacheDir, 'Wesley.zip'), Buffer.from('not a zip'));
  await assert.rejects(
    ingestSword(openDb(), fakeFetcher(Buffer.alloc(0)), { moduleId: 'Wesley', cacheDir }),
    (e) => /end-of-central-directory/.test(e.message) && e.message.includes(path.join(cacheDir, 'Wesley.zip')),
  );
});

test('a module with no data files is an error, not an empty success', async () => {
  const zip = buildModuleZip({ id: 'Wesley' });
  await assert.rejects(ingestSword(openDb(), fakeFetcher(zip), { moduleId: 'Wesley', cacheDir: await tmp() }), /no ot\/nt data files/);
});

test('unknown module id is rejected without fetching', async () => {
  const fetcher = fakeFetcher(Buffer.alloc(0));
  await assert.rejects(ingestSword(openDb(), fetcher, { moduleId: 'Nope', cacheDir: await tmp() }), /Unknown SWORD module/);
  assert.equal(fetcher.calls.length, 0);
});

test('an all-stub parse refuses to wipe the rows of an earlier ingest', async () => {
  const db = openDb();
  const cacheDir = await tmp();
  const good = buildModuleZip({ id: 'Barnes', nt: [{ slots: [s('mat', 1, 3)], text: 'Real note' }] });
  await ingestSword(db, fakeFetcher(good), { moduleId: 'Barnes', cacheDir });
  await fs.rm(path.join(cacheDir, 'Barnes.zip'));
  const stub = buildModuleZip({ id: 'Barnes', nt: [{ slots: [s('mat', 1, 3)], text: 'No specific Barnes text on this verse' }] });
  await assert.rejects(ingestSword(db, fakeFetcher(stub), { moduleId: 'Barnes', cacheDir }), /parsed 0 usable entries/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM passages WHERE commentary_id = ?').get('barnes').n, 1);
});

test('a verse index of the wrong size is rejected', async () => {
  const { zs, zv, zz } = buildTestament(slotCount('ot') + 5, [{ slots: [s('gen', 1, 1)], text: 'x' }]);
  const conf = '[Wesley]\nDataPath=./modules/comments/zcom/wesley/\nModDrv=zCom\nSourceType=ThML\nBlockType=BOOK\nCompressType=ZIP\nDistributionLicense=Public Domain\n';
  const zip = buildZip([
    { name: 'mods.d/wesley.conf', data: Buffer.from(conf) },
    { name: 'modules/comments/zcom/wesley/ot.bzs', data: zs },
    { name: 'modules/comments/zcom/wesley/ot.bzv', data: zv },
    { name: 'modules/comments/zcom/wesley/ot.bzz', data: zz },
  ]);
  await assert.rejects(
    ingestSword(openDb(), fakeFetcher(zip), { moduleId: 'Wesley', cacheDir: await tmp() }),
    /verse index has .* records, expected 24115/,
  );
});
