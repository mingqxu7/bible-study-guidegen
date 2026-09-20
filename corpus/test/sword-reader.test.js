import test from 'node:test';
import assert from 'node:assert/strict';
import { slotCount, verseSlot } from '../lib/kjv.js';
import {
  parseConf, assertSupported, cleanMarkup, isStub, openTestament, bookEntries,
} from '../sources/sword-reader.js';
import { buildTestament } from './helpers/sword-fixtures.js';

const s = verseSlot;
const OT = slotCount('ot');

test('parseConf reads key=value, ignores the [section] line, handles CRLF and continuations', () => {
  const text = '[Barnes]\r\nDataPath=./modules/comments/zcom/barnes/\r\nModDrv=zCom\r\n' +
    'About=first line \\\r\nsecond line with Encoding=Latin1 in it\r\nDistributionLicense=Public Domain\r\n';
  const conf = parseConf(text);
  assert.equal(conf.DataPath, './modules/comments/zcom/barnes/');
  assert.equal(conf.ModDrv, 'zCom');
  assert.equal(conf.DistributionLicense, 'Public Domain');
  assert.equal(conf.Encoding, undefined); // was inside a continued About value
  assert.equal(conf.About.startsWith('first line'), true);
});

const goodConf = {
  DataPath: './modules/comments/zcom/wesley/', ModDrv: 'zCom', BlockType: 'BOOK',
  CompressType: 'ZIP', DistributionLicense: 'Public Domain',
};

test('assertSupported accepts a supported conf (Encoding and Versification may be absent)', () => {
  assert.doesNotThrow(() => assertSupported(goodConf, 'Wesley'));
  assert.doesNotThrow(() => assertSupported({ ...goodConf, Encoding: 'UTF-8', Versification: 'KJV', BlockType: 'CHAPTER' }, 'Barnes'));
});

test('assertSupported refuses anything it cannot read faithfully', () => {
  const bad = [
    [{ DistributionLicense: 'Copyrighted' }, /Public Domain/],
    [{ DistributionLicense: undefined }, /Public Domain/],
    [{ ModDrv: 'zCom4' }, /ModDrv zCom4/],
    [{ CompressType: 'LZSS' }, /CompressType/],
    [{ BlockType: 'VERSE' }, /BlockType/],
    [{ Encoding: 'Latin1' }, /Encoding/],
    [{ Versification: 'Synodal' }, /Versification/],
    [{ DataPath: undefined }, /DataPath/],
  ];
  for (const [patch, re] of bad) {
    assert.throws(() => assertSupported({ ...goodConf, ...patch }, 'X'), (e) => /^Refusing X:/.test(e.message) && re.test(e.message));
  }
});

test('cleanMarkup strips ThML/OSIS tags, keeps line breaks, decodes entities', () => {
  assert.equal(cleanMarkup('  A <br /> B<br/><br/><br/>C'), 'A\nB\n\nC');
  assert.equal(
    cleanMarkup('<div type="x-p">One</div><title>T</title>Two &amp; &#65;&#x42; &nbsp;x'),
    'One\nT\nTwo & AB x',
  );
  assert.equal(cleanMarkup('Verse 4. <scripRef passage="Mt 1:3">Mt 1:3</scripRef>.'), 'Verse 4. Mt 1:3.');
  assert.equal(cleanMarkup('<div sID="g1"/>Hello <hi type="italic">world</hi><div eID="g1"/>'), 'Hello world');
  assert.equal(cleanMarkup('   <br />  '), '');
});

test('isStub recognises Barnes "no text" placeholders but not real notes', () => {
  assert.equal(isStub('Verse 4. No specific Barnes text on this verse. Mt 1:3.'), true);
  assert.equal(isStub('A real note about the verse.'), false);
  const longNote = `No specific Barnes text on this verse. ${'x'.repeat(900)}`;
  assert.equal(isStub(longNote), false);
});

test('openTestament: locate() is null for empty slots and read() returns the right bytes (packed block)', () => {
  const t = openTestament(buildTestament(OT, [
    { slots: [s('gen', 1, 1)], text: 'Alpha' },
    { slots: [s('gen', 1, 2), s('gen', 1, 3)], text: 'Béta ünïcode' },
  ], { pack: true }), 'test');
  assert.equal(t.recordCount, OT);
  assert.equal(t.locate(s('gen', 1, 4)), null);
  assert.equal(t.read(t.locate(s('gen', 1, 1))), 'Alpha');
  const a = t.locate(s('gen', 1, 2));
  const b = t.locate(s('gen', 1, 3));
  assert.deepEqual(a, b); // same (block, offset, size) triple => same note
  assert.equal(t.read(a), 'Béta ünïcode');
});

test('openTestament fails loudly on a corrupt index', () => {
  const files = buildTestament(OT, [{ slots: [s('gen', 1, 1)], text: 'Alpha' }]);
  const badLen = { ...files, zs: Buffer.from(files.zs) };
  badLen.zs.writeUInt32LE(999, 8); // claim a different uncompressed size
  const t = openTestament(badLen, 'mod ot');
  assert.throws(() => t.read(t.locate(s('gen', 1, 1))), /mod ot: block 0 inflated to 5 bytes, index says 999/);

  const ok = openTestament(files, 'mod ot');
  assert.throws(() => ok.locate(OT), /outside 0\.\./);
  const pastEnd = { ...files, zv: Buffer.from(files.zv) };
  pastEnd.zv.writeUInt32LE(3, s('gen', 1, 1) * 10 + 4); // offset 3 + size 5 > block length 5
  const t2 = openTestament(pastEnd, 'mod ot');
  assert.throws(() => t2.read(t2.locate(s('gen', 1, 1))), /past the end of block/);
});

test('bookEntries groups slots sharing one note, across chapters, ignoring heading slots', () => {
  const chapter2Heading = s('gen', 2, 1) - 1;
  const t = openTestament(buildTestament(OT, [
    { slots: [s('gen', 1, 1)], text: 'first' },
    // one note spanning 1:31 through 2:2; its slots include the chapter-2 heading slot, which is skipped
    { slots: [s('gen', 1, 31), chapter2Heading, s('gen', 2, 1), s('gen', 2, 2)], text: 'span' },
    // 2:3 is empty, then two adjacent slots with different notes
    { slots: [s('gen', 2, 4)], text: 'B' },
    { slots: [s('gen', 2, 5)], text: 'B2' },
    // a note stored only in chapter 3's heading slot: headings are never read, so it must not appear
    { slots: [s('gen', 3, 1) - 1], text: 'HEADING ONLY' },
  ]), 'test');
  assert.deepEqual([...bookEntries(t, 'gen')], [
    { chapter: 1, verseStart: 1, endChapter: 1, verseEnd: 1, text: 'first' },
    { chapter: 1, verseStart: 31, endChapter: 2, verseEnd: 2, text: 'span' },
    { chapter: 2, verseStart: 4, endChapter: 2, verseEnd: 4, text: 'B' },
    { chapter: 2, verseStart: 5, endChapter: 2, verseEnd: 5, text: 'B2' },
  ]);
  assert.deepEqual([...bookEntries(t, 'exo')], []);
});
