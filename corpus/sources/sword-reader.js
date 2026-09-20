import zlib from 'node:zlib';
import { chapterCount, verseSlot, versesIn } from '../lib/kjv.js';

// ---- .conf ----

export function parseConf(text) {
  const conf = {};
  const joined = text.replace(/\\\r?\n/g, ' '); // SWORD continues long values with a trailing backslash
  for (const line of joined.split(/\r?\n/)) {
    const m = /^([A-Za-z][A-Za-z0-9_.-]*)=(.*)$/.exec(line);
    if (m) conf[m[1]] = m[2].trim();
  }
  return conf;
}

// Only what this reader can decode faithfully, and only public-domain modules.
export function assertSupported(conf, moduleId = 'module') {
  const problems = [];
  if (conf.DistributionLicense !== 'Public Domain') {
    problems.push(`DistributionLicense is ${JSON.stringify(conf.DistributionLicense)}, not "Public Domain"`);
  }
  if (conf.ModDrv !== 'zCom') problems.push(`ModDrv ${conf.ModDrv} is not supported (only zCom)`);
  if (conf.CompressType !== 'ZIP') problems.push(`CompressType ${conf.CompressType} is not supported (only ZIP)`);
  if (conf.BlockType !== 'BOOK' && conf.BlockType !== 'CHAPTER') {
    problems.push(`BlockType ${conf.BlockType} is not supported (only BOOK or CHAPTER)`);
  }
  if (conf.Encoding !== undefined && conf.Encoding.toUpperCase() !== 'UTF-8') {
    problems.push(`Encoding ${conf.Encoding} is not supported (only UTF-8)`);
  }
  if (conf.Versification !== undefined && conf.Versification !== 'KJV') {
    problems.push(`Versification ${conf.Versification} is not supported (only KJV)`);
  }
  if (!conf.DataPath) problems.push('DataPath is missing');
  if (problems.length) throw new Error(`Refusing ${moduleId}: ${problems.join('; ')}`);
}

// ---- markup ----

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? match;
  });
}

// ThML (Wesley, Barnes) and OSIS (Luther) to plain text.
export function cleanMarkup(raw) {
  const stripped = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<div[^>]*type="x-p"[^>]*>/gi, '\n')
    .replace(/<\/(?:p|title|div)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(stripped)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Barnes has placeholder entries for verses he did not comment on.
export function isStub(text) {
  return /No specific Barnes text on this verse/i.test(text) && text.length < 800;
}

// ---- zCom testament files (.?zs block index, .?zv verse index, .?zz compressed blocks) ----

export function openTestament({ zs, zv, zz }, label = 'testament') {
  if (zv.length % 10 !== 0) throw new Error(`${label}: verse index length ${zv.length} is not a multiple of 10`);
  const recordCount = zv.length / 10;
  const blocks = new Map();

  function block(n) {
    if (blocks.has(n)) return blocks.get(n);
    if ((n + 1) * 12 > zs.length) throw new Error(`${label}: block ${n} is outside the block index`);
    const offset = zs.readUInt32LE(n * 12);
    const csize = zs.readUInt32LE(n * 12 + 4);
    const usize = zs.readUInt32LE(n * 12 + 8);
    const data = zlib.inflateSync(zz.subarray(offset, offset + csize));
    if (data.length !== usize) {
      throw new Error(`${label}: block ${n} inflated to ${data.length} bytes, index says ${usize}`);
    }
    blocks.set(n, data);
    return data;
  }

  return {
    recordCount,
    // Cheap: reads only the 10-byte index record. Two slots with equal (block, offset, size) share one note.
    locate(slot) {
      if (slot < 0 || slot >= recordCount) throw new Error(`${label}: slot ${slot} is outside 0..${recordCount - 1}`);
      const size = zv.readUInt16LE(slot * 10 + 8);
      if (size === 0) return null;
      return { block: zv.readUInt32LE(slot * 10), offset: zv.readUInt32LE(slot * 10 + 4), size };
    },
    read({ block: b, offset, size }) {
      const data = block(b);
      if (offset + size > data.length) throw new Error(`${label}: entry reads past the end of block ${b}`);
      return data.toString('utf8', offset, offset + size);
    },
  };
}

// Walks a book's verses in reading order and yields one entry per run of consecutive verse slots
// that point at the same note (a note for a range is stored once and referenced by every verse in
// it). Runs continue across chapter boundaries; heading slots are never read.
export function* bookEntries(testament, code) {
  let cur = null;
  const flush = function* () {
    if (cur) {
      yield { chapter: cur.chapter, verseStart: cur.verseStart, endChapter: cur.endChapter, verseEnd: cur.verseEnd, text: cur.text };
      cur = null;
    }
  };
  for (let c = 1; c <= chapterCount(code); c++) {
    for (let v = 1; v <= versesIn(code, c); v++) {
      const loc = testament.locate(verseSlot(code, c, v));
      if (!loc) { yield* flush(); continue; }
      const key = `${loc.block}:${loc.offset}:${loc.size}`;
      if (cur && cur.key === key) {
        cur.endChapter = c;
        cur.verseEnd = v;
      } else {
        yield* flush();
        cur = { key, chapter: c, verseStart: v, endChapter: c, verseEnd: v, text: testament.read(loc) };
      }
    }
  }
  yield* flush();
}
