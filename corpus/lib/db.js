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
