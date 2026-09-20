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
