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
