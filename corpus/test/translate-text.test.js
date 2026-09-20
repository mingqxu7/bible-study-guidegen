import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_VERSION, LANG, DEFAULT_MODEL, SYSTEM_PROMPT, buildUserMessage,
  chunkText, stitch, cjkCount, checkRatio, formatRef,
} from '../lib/translate.js';

test('constants', () => {
  assert.equal(PROMPT_VERSION, 'zh-hans-v2');
  assert.equal(LANG, 'zh-Hans');
  assert.equal(DEFAULT_MODEL, 'claude-sonnet-5');
});

test('the system prompt fixes the 上帝 convention and the key rules', () => {
  assert.match(SYSTEM_PROMPT, /上帝/);
  assert.match(SYSTEM_PROMPT, /耶和华/);
  assert.match(SYSTEM_PROMPT, /Simplified Chinese/);
  assert.match(SYSTEM_PROMPT, /ONLY the Chinese translation/);
  assert.match(SYSTEM_PROMPT, /&c\./);
  assert.match(SYSTEM_PROMPT, /Never summarize/);
});

test('the system prompt fixes the 和合本 pronoun convention (他 for God, Christ, the Spirit and the devil; never 祂)', () => {
  assert.match(SYSTEM_PROMPT, /Pronouns/);
  assert.match(SYSTEM_PROMPT, /他 for God, Jesus Christ, the Holy Spirit and the devil/);
  assert.match(SYSTEM_PROMPT, /never 祂/);
  assert.match(SYSTEM_PROMPT, /它 only for animals and things/);
});

test('buildUserMessage names the commentary and passage; parts only when chunked', () => {
  const single = buildUserMessage({ commentaryName: "Gill's Exposition", ref: 'Romans 8:28', part: 1, parts: 1, text: 'Body.' });
  assert.match(single, /Commentary: Gill's Exposition/);
  assert.match(single, /Passage: Romans 8:28/);
  assert.doesNotMatch(single, /Part 1 of/);
  assert.ok(single.endsWith('\n\nBody.'));
  const multi = buildUserMessage({ commentaryName: 'X', ref: 'Y', part: 2, parts: 3, text: 'B' });
  assert.match(multi, /Part 2 of 3/);
});

test('chunkText: short text is one chunk', () => {
  assert.deepEqual(chunkText('Hello world.'), [{ text: 'Hello world.', sep: '' }]);
});

test('chunkText packs paragraphs up to the limit and remembers the separator', () => {
  const chunks = chunkText('aaaa\n\nbbbb\n\ncccc', 10);
  assert.deepEqual(chunks, [{ text: 'aaaa\n\nbbbb', sep: '\n\n' }, { text: 'cccc', sep: '' }]);
});

test('chunkText splits an oversize paragraph at sentence boundaries without inventing paragraph breaks', () => {
  const para = 'First sentence here. Second sentence here. Third one.';
  const chunks = chunkText(para, 30);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.text.length <= 30));
  assert.equal(stitch(chunks, chunks.map((c) => c.text)), para);
});

test('chunkText hard-splits a long unbroken run and stitches it back exactly', () => {
  const chunks = chunkText('abcdefghijkl', 5);
  assert.deepEqual(chunks.map((c) => c.text), ['abcde', 'fghij', 'kl']);
  assert.equal(stitch(chunks, chunks.map((c) => c.text)), 'abcdefghijkl');
});

test('chunkText ignores empty paragraphs and surrounding blank lines', () => {
  assert.deepEqual(chunkText('\n\n  one\n\n\n\ntwo\n\n'), [{ text: 'one\n\ntwo', sep: '' }]);
});

test('stitch rejoins translated chunks with the original separators and trims each', () => {
  const chunks = [{ text: 'a', sep: '\n\n' }, { text: 'b', sep: ' ' }, { text: 'c', sep: '' }];
  assert.equal(stitch(chunks, ['甲 ', ' 乙', '丙\n']), '甲\n\n乙 丙');
});

test('cjkCount counts only CJK ideographs', () => {
  assert.equal(cjkCount('上帝 is God 爱, 2 Cor 5:17'), 3);
  assert.equal(cjkCount(''), 0);
});

test('checkRatio: passes a normal ratio, fails too short and too long, skips short English', () => {
  const en = 'x'.repeat(400);
  assert.equal(checkRatio(en, '译'.repeat(120)), null); // 0.30
  assert.match(checkRatio(en, '译'.repeat(12)), /ratio 0\.03/); // 12 / 400 = 0.03
  assert.match(checkRatio(en, '译'.repeat(300)), /ratio 0\.75/);
  assert.equal(checkRatio('Short English text.', '译'), null); // under 200 characters: not checked
});

test('formatRef renders single verses, ranges and cross-chapter ranges', () => {
  const base = { book: 'rom', chapter: 8, verseStart: 28, endChapter: 8, verseEnd: 28 };
  assert.equal(formatRef(base), 'Romans 8:28');
  assert.equal(formatRef({ ...base, verseEnd: 30 }), 'Romans 8:28-30');
  assert.equal(formatRef({ ...base, endChapter: 9, verseEnd: 3 }), 'Romans 8:28-9:3');
  assert.equal(formatRef({ ...base, book: '1co' }), '1 Corinthians 8:28');
});
