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
    const end = sectionLevel ? (next ? next.number - 1 : Number.isFinite(json.numberOfVerses) ? json.numberOfVerses : v.number) : v.number;
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
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`concurrency must be a positive integer, got ${concurrency}`);
  }
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
