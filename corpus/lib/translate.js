import { AuthError } from './anthropic.js';
import { getTranslation, saveTranslation } from './db.js';
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

// ---- selecting passages ----

// chapter only: passages that start in that chapter.
// chapter + verse: passages whose range covers that verse (ranges may cross chapters).
export function selectPassages(db, commentaryId, book, chapter, verse = null) {
  let sql = `SELECT commentary_id AS commentaryId, book, chapter, verse_start AS verseStart,
      end_chapter AS endChapter, verse_end AS verseEnd, seq, text
    FROM passages WHERE commentary_id = ? AND book = ? AND `;
  const args = [commentaryId, book];
  if (verse === null) {
    sql += 'chapter = ?';
    args.push(chapter);
  } else {
    sql += '(chapter < ? OR (chapter = ? AND verse_start <= ?)) AND (end_chapter > ? OR (end_chapter = ? AND verse_end >= ?))';
    args.push(chapter, chapter, verse, chapter, chapter, verse);
  }
  sql += ' ORDER BY chapter, verse_start, seq';
  return db.prepare(sql).all(...args).map((r) => ({ ...r }));
}

// ---- translating one passage ----

// Sonnet 5 thinking tokens share this budget; a failed passage discards already-paid chunks
const MAX_TOKENS = 16000;

export async function translatePassage(db, client, passage, opts = {}) {
  const { commentaryName = passage.commentaryId, force = false, now = () => new Date().toISOString() } = opts;
  const key = {
    commentaryId: passage.commentaryId, book: passage.book, chapter: passage.chapter, verseStart: passage.verseStart,
    endChapter: passage.endChapter, verseEnd: passage.verseEnd, seq: passage.seq,
  };
  const where = { lang: LANG, model: client.model, promptVersion: PROMPT_VERSION };
  if (!force && getTranslation(db, key, where)) return { status: 'cached' };

  const chunks = chunkText(passage.text);
  if (!chunks.length) return { status: 'failed', error: 'passage text is empty' };
  const ref = formatRef(passage);
  const translated = [];
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for (let i = 0; i < chunks.length; i++) {
      const res = await client.complete({
        system: SYSTEM_PROMPT,
        user: buildUserMessage({ commentaryName, ref, part: i + 1, parts: chunks.length, text: chunks[i].text }),
        maxTokens: MAX_TOKENS,
      });
      if (res.stopReason === 'max_tokens') throw new Error(`reply hit max_tokens on part ${i + 1}/${chunks.length}`);
      const text = res.text.trim();
      if (!text) throw new Error(`empty reply on part ${i + 1}/${chunks.length}`);
      translated.push(text);
      inputTokens += res.inputTokens;
      outputTokens += res.outputTokens;
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    return { status: 'failed', error: err.message };
  }

  const text = stitch(chunks, translated);
  if (cjkCount(text) === 0) return { status: 'failed', error: 'reply contains no Chinese characters' };
  const problem = checkRatio(passage.text, text);
  if (problem) return { status: 'failed', error: problem };

  saveTranslation(db, { ...key, ...where, text, inputTokens, outputTokens, createdAt: now() });
  return { status: 'translated', inputTokens, outputTokens };
}
