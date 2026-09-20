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

    const emptyAuthors = authors.filter((a) => !found.some((r) => r.father_name === a));
    if (emptyAuthors.length) {
      throw new Error(`HCF source has no rows for allowlisted author(s): ${emptyAuthors.join(', ')}`);
    }

    const byId = new Map(Object.values(HCF_AUTHORS).map((a) => [a.id, []]));
    const seen = new Map();
    const skippedBooks = new Set();
    const norm = (b) => String(b).toLowerCase().replace(/[^a-z0-9]/g, '');
    const fetchedAt = now();

    for (const r of found) {
      const code = HCF_NAME_TO_CODE[norm(r.book)];
      if (!code) { skippedBooks.add(String(r.book)); continue; }
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
    return {
      rows: Object.values(perCommentary).reduce((a, b) => a + b, 0),
      skippedBooks: [...skippedBooks].sort(), emptyAuthors, perCommentary,
    };
  } finally {
    src.close();
  }
}
