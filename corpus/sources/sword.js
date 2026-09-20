import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { replacePassages, upsertSource } from '../lib/db.js';
import { TESTAMENT_BOOKS } from '../lib/kjv.js';
import { SWORD_MODULES } from '../lib/licenses.js';
import { readZip } from '../lib/zip.js';
import { assertSupported, bookEntries, cleanMarkup, isStub, openTestament, parseConf } from './sword-reader.js';

const DEFAULT_BASE = 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip';

async function ensureZip(fetcher, url, dest) {
  if (fs.existsSync(dest)) return;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const res = await fetcher.fetch(url, { as: 'response' });
  const partial = `${dest}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
  await fsp.rename(partial, dest);
}

export async function ingestSword(db, fetcher, opts) {
  const { moduleId, cacheDir, baseUrl = DEFAULT_BASE, now = () => new Date().toISOString(), log = () => {} } = opts;
  const meta = SWORD_MODULES[moduleId];
  if (!meta) throw new Error(`Unknown SWORD module: ${moduleId}`);

  const url = `${baseUrl}/${moduleId}.zip`;
  const zipPath = path.join(cacheDir, `${moduleId}.zip`);
  await ensureZip(fetcher, url, zipPath);

  let files;
  try {
    files = readZip(await fsp.readFile(zipPath));
  } catch (err) {
    throw new Error(`${err.message}. If the download is corrupt, delete ${zipPath} and rerun.`);
  }
  const confName = [...files.keys()].find((n) => /^mods\.d\/[^/]+\.conf$/.test(n));
  if (!confName) throw new Error(`Refusing ${moduleId}: no mods.d/*.conf in the archive`);
  const conf = parseConf(files.get(confName).toString('utf8'));
  assertSupported(conf, moduleId);

  const dataPath = conf.DataPath.replace(/^\.\//, '').replace(/\/?$/, '/');
  const ext = conf.BlockType === 'BOOK' ? 'bz' : 'cz';
  const fetchedAt = now();
  const out = [];
  const books = new Set();
  const testaments = [];

  for (const testament of ['ot', 'nt']) {
    const [zs, zv, zz] = ['s', 'v', 'z'].map((k) => files.get(`${dataPath}${testament}.${ext}${k}`));
    if (!zs || !zv || !zz) continue; // e.g. Barnes has no Old Testament
    testaments.push(testament);
    const t = openTestament({ zs, zv, zz }, `${moduleId} ${testament}`);
    for (const code of TESTAMENT_BOOKS[testament]) {
      for (const e of bookEntries(t, code)) {
        const text = cleanMarkup(e.text);
        if (!text || isStub(text)) continue;
        books.add(code);
        out.push({
          commentaryId: meta.id, source: 'sword', book: code, chapter: e.chapter, verseStart: e.verseStart,
          endChapter: e.endChapter, verseEnd: e.verseEnd, seq: 0, text, license: conf.DistributionLicense, fetchedAt,
        });
      }
    }
    log(`${meta.id} ${testament}: ${out.length} rows so far`);
  }
  if (!testaments.length) throw new Error(`${moduleId}: no ot/nt data files found under ${dataPath}`);

  upsertSource(db, {
    commentaryId: meta.id, name: meta.name, author: meta.author, source: 'sword', sourceUrl: url,
    license: conf.DistributionLicense, attribution: 'CrossWire Bible Society, The SWORD Project', notes: meta.notes,
  });
  replacePassages(db, meta.id, out);
  return { testaments, books: books.size, rows: out.length };
}
