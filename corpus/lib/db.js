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
  notes TEXT,
  access TEXT NOT NULL DEFAULT 'open'
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
  // CREATE TABLE IF NOT EXISTS cannot add a column to a table that already exists, so a database
  // written before `access` existed needs it added here. Existing rows default to 'open'.
  const hasAccess = db.prepare('PRAGMA table_info(sources)').all().some((c) => c.name === 'access');
  if (!hasAccess) db.exec("ALTER TABLE sources ADD COLUMN access TEXT NOT NULL DEFAULT 'open'");
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

export const ACCESS_LEVELS = ['open', 'restricted'];

export function upsertSource(db, s) {
  // `access` is deliberately NOT taken from `excluded`: a re-ingest passes none, and must leave a
  // restricted commentary restricted rather than silently reopening it.
  db.prepare(`
    INSERT INTO sources (commentary_id, name, author, source, source_url, license, attribution, notes, access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'open'))
    ON CONFLICT (commentary_id) DO UPDATE SET
      name = excluded.name, author = excluded.author, source = excluded.source,
      source_url = excluded.source_url, license = excluded.license,
      attribution = excluded.attribution, notes = excluded.notes,
      access = COALESCE(?, sources.access)`)
    .run(s.commentaryId, s.name, s.author ?? null, s.source, s.sourceUrl ?? null,
      s.license, s.attribution ?? null, s.notes ?? null, s.access ?? null, s.access ?? null);
}

export function getAccess(db, commentaryId) {
  const row = db.prepare('SELECT access FROM sources WHERE commentary_id = ?').get(commentaryId);
  return row ? row.access : null;
}

// Access is metadata, not enforcement: anyone holding the sqlite file can read every row. It
// records the intent for whatever serves the corpus later.
export function setAccess(db, commentaryId, access) {
  if (!ACCESS_LEVELS.includes(access)) {
    throw new Error(`access must be one of: ${ACCESS_LEVELS.join(', ')}`);
  }
  const { changes } = db.prepare('UPDATE sources SET access = ? WHERE commentary_id = ?').run(access, commentaryId);
  if (!changes) throw new Error(`Unknown commentary "${commentaryId}"`);
}

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
