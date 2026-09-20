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
