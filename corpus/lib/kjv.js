import { bibleBounds } from '../../backend/services/bibleBounds.js';
import { BOOKS } from './books.js';

// backend/services/bibleBounds.js has Isaiah 55 as 11 verses; the KJV (and the KJV-layout SWORD
// modules) have 13. Corrected here so this package does not depend on a fix in backend/.
const VERSE_COUNT_OVERRIDES = { isa: { 55: 13 } };

export const TESTAMENT_BOOKS = {
  ot: BOOKS.slice(0, 39).map((b) => b.code),
  nt: BOOKS.slice(39).map((b) => b.code),
};

export function versesIn(code, chapter) {
  return VERSE_COUNT_OVERRIDES[code]?.[chapter] ?? bibleBounds[code].verses[chapter];
}

export function chapterCount(code) {
  return bibleBounds[code].chapters;
}

// A SWORD verse index (.?zv) is one record per slot: slots 0-1 are module/testament headings,
// then for each book: a book heading, then for each chapter a chapter heading followed by its verses.
function buildLayout(codes) {
  let next = 2;
  const firstVerse = new Map();
  for (const code of codes) {
    next += 1; // book heading
    const chapters = new Map();
    for (let c = 1; c <= chapterCount(code); c++) {
      next += 1; // chapter heading
      chapters.set(c, next); // slot of verse 1
      next += versesIn(code, c);
    }
    firstVerse.set(code, chapters);
  }
  return { total: next, firstVerse };
}

const LAYOUT = { ot: buildLayout(TESTAMENT_BOOKS.ot), nt: buildLayout(TESTAMENT_BOOKS.nt) };

function testamentOf(code) {
  if (TESTAMENT_BOOKS.ot.includes(code)) return 'ot';
  if (TESTAMENT_BOOKS.nt.includes(code)) return 'nt';
  throw new Error(`kjv: unknown book ${code}`);
}

export function slotCount(testament) {
  return LAYOUT[testament].total;
}

export function verseSlot(code, chapter, verse) {
  const chapters = LAYOUT[testamentOf(code)].firstVerse.get(code);
  if (!chapters.has(chapter) || verse < 1 || verse > versesIn(code, chapter)) {
    throw new Error(`kjv: no such verse ${code} ${chapter}:${verse}`);
  }
  return chapters.get(chapter) + verse - 1;
}
