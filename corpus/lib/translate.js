import { BOOKS } from './books.js';

export const PROMPT_VERSION = 'zh-hans-v1';
export const LANG = 'zh-Hans';
export const DEFAULT_MODEL = 'claude-sonnet-5';

export const SYSTEM_PROMPT = `You translate historic English Bible commentaries into Simplified Chinese (简体中文).

Output ONLY the Chinese translation of the text you are given: no preface, no notes, no explanations, no markdown fences.

Rules:
1. Register: formal, reverent, natural theological Chinese, as in a printed Chinese commentary. Keep the historic author's voice.
2. Use the Chinese Union Version (和合本) 上帝版 terminology: 上帝 for "God" (not 神), 耶和华 for the LORD/Jehovah, 耶稣基督, 圣灵, 以色列, 大卫, 摩西, 称义, 圣化, 救赎. Render Scripture quotations in 和合本-style wording.
3. Bible book names: standard Chinese names (Romans -> 罗马书, Genesis -> 创世记). Keep chapter:verse numerals unchanged (罗马书 8:28).
4. Keep Hebrew, Greek and Latin words exactly as written. Add a short Chinese gloss in parentheses only where the author himself explains the word.
5. Render archaic abbreviations such as "&c." as 等等 and "i.e." as 即.
6. Translate everything. Never summarize, shorten, reorder, omit or add anything. Preserve paragraph breaks, numbering and list structure.
7. Other authors and works: use the common Chinese rendering when well known, otherwise keep the original spelling.
8. If the text is marked "Part i of n", translate only that part and keep the terminology consistent with the rest of the passage.`;

export function buildUserMessage({ commentaryName, ref, part, parts, text }) {
  const partLine = parts > 1 ? `Part ${part} of ${parts}\n` : '';
  return `Commentary: ${commentaryName}\nPassage: ${ref}\n${partLine}\nTranslate the following text:\n\n${text}`;
}

// ---- chunking ----

// Splits text into pieces that each remember the separator that followed them originally:
// "\n\n" between paragraphs, " " between sentences of an oversize paragraph, "" inside a hard split.
function toPieces(text, limit) {
  const paragraphs = text.trim().split(/\n{2,}/).filter((p) => p.trim());
  const pieces = [];
  paragraphs.forEach((p, i) => {
    const paraSep = i < paragraphs.length - 1 ? '\n\n' : '';
    if (p.length <= limit) {
      pieces.push({ text: p, sep: paraSep });
      return;
    }
    const units = [];
    for (const sentence of p.split(/(?<=[.?!;])\s+/)) {
      for (let k = 0; k < sentence.length; k += limit) {
        const isLast = k + limit >= sentence.length;
        units.push({ text: sentence.slice(k, k + limit), sep: isLast ? ' ' : '' });
      }
    }
    units[units.length - 1].sep = paraSep;
    pieces.push(...units);
  });
  return pieces;
}

export function chunkText(text, limit = 6000) {
  const chunks = [];
  let cur = null;
  for (const piece of toPieces(text, limit)) {
    if (cur && cur.text.length + cur.sep.length + piece.text.length <= limit) {
      cur = { text: cur.text + cur.sep + piece.text, sep: piece.sep };
    } else {
      if (cur) chunks.push(cur);
      cur = { text: piece.text, sep: piece.sep };
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export function stitch(chunks, translations) {
  return chunks.map((c, i) => translations[i].trim() + c.sep).join('');
}

// ---- sanity check ----

export function cjkCount(s) {
  return (s.match(/[一-鿿]/g) ?? []).length;
}

// Observed on the 96-translation sample study: Chinese is 20-31% of the English length.
export function checkRatio(english, chinese) {
  if (english.length < 200) return null;
  const ratio = cjkCount(chinese) / english.length;
  if (ratio >= 0.1 && ratio <= 0.6) return null;
  return `implausible length ratio ${ratio.toFixed(2)} (expected 0.10-0.60 Chinese characters per English character)`;
}

// ---- references ----

const BOOK_NAME = Object.fromEntries(BOOKS.map((b) => [b.code, b.name]));

export function formatRef({ book, chapter, verseStart, endChapter, verseEnd }) {
  const name = BOOK_NAME[book] ?? book;
  const start = `${name} ${chapter}:${verseStart}`;
  if (endChapter !== chapter) return `${start}-${endChapter}:${verseEnd}`;
  if (verseEnd !== verseStart) return `${start}-${verseEnd}`;
  return start;
}
