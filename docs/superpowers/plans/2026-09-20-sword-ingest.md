# SWORD Module Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Wesley's Notes, Barnes' Notes and Luther (selected passages) to the `corpus/` sqlite database from CrossWire SWORD module ZIPs, using a zero-dependency pure-Node reader.

**Architecture:** A small ZIP reader and a KJV verse-slot table feed a SWORD `zCom` reader (block index + verse index + zlib blocks). The ingest adapter downloads each module ZIP once (30 s host interval), checks the module's `.conf` license and driver, groups consecutive verse slots that share one note into one row, strips ThML/OSIS markup, and replaces the module's rows in one transaction.

**Tech Stack:** Node >= 22.13 (`node:zlib`, `node:sqlite`, `node:test`, global `fetch`), ESM, no npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-20-sword-ingest-design.md` (extends `2026-09-20-commentary-corpus-design.md`)

**Spec delta decided while planning:** the SWORD format code lives in `sources/sword-reader.js` and the download/ingest in `sources/sword.js` (the spec listed a single `sword.js`); the reader's `openTestament` returns `locate(slot)` and `read(loc)` separately so a note shared by thousands of verse slots is decoded once per group, not once per slot.

## Global Constraints

- No StudyLight.org access of any kind; no traffic disguise; every request uses the honest, identified User-Agent from the existing fetcher.
- CrossWire `robots.txt` sets `Crawl-delay: 30`: only the three module ZIP URLs (`https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/<id>.zip`) are ever requested, at least 30 s apart, never anything under `/study/` or `raw/modules/`.
- Retry with backoff on 429/5xx; a 403 stops the run and is never worked around (existing fetcher behavior).
- Public-domain only: refuse a module unless its `.conf` has `DistributionLicense=Public Domain`; each row carries that license string.
- Standalone package: only `corpus/` changes (plus docs). No changes to `backend/` or `frontend/`. The Isaiah 55 verse-count correction lives in `corpus/lib/kjv.js`, not in `backend/`.
- Books use the existing 3-letter codes (`corpus/lib/books.js`, matching `backend/services/bibleBounds.js`).
- Node >= 22.13, ESM, no npm dependencies.
- `upsertPassages`/`replacePassages`/`upsertSource` open their own transaction and cannot be nested; never wrap them in `BEGIN`.
- Commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Work on a feature branch, not `main`.

## File Structure

```
corpus/
  lib/zip.js                   # readZip(buffer) -> Map(name -> Buffer)
  lib/kjv.js                   # KJV slot layout from bibleBounds (+ Isaiah 55 override)
  lib/licenses.js              # + SWORD_MODULES            (modify)
  sources/sword-reader.js      # parseConf, assertSupported, cleanMarkup, isStub, openTestament, bookEntries
  sources/sword.js             # ingestSword (download, cache, read, replace rows)
  cli.js                       # + `ingest sword`           (modify)
  README.md                    # + usage                    (modify)
  test/helpers/zip-builder.js  # buildZip (test-only)
  test/helpers/sword-fixtures.js  # buildTestament, buildModuleZip (test-only)
  test/zip.test.js  test/kjv.test.js  test/sword-reader.test.js  test/sword.test.js
```

Real-data anchors used in tests (verified on 2026-09-20 against the real Wesley module): OT has 24115 records and NT 8246; Gen 1:1 is OT slot 4; Isa 55:13 is OT slot 19512; Mal 4:6 is OT slot 24114 (the last record); Matt 1:1 is NT slot 4; Rev 22:21 is NT slot 8245 (the last record).

---

### Task 1: ZIP reader

**Files:**
- Create: `corpus/lib/zip.js`, `corpus/test/helpers/zip-builder.js`
- Test: `corpus/test/zip.test.js`

**Interfaces:**
- Produces: `readZip(buffer: Buffer) -> Map<string, Buffer>` (entry name -> decompressed bytes; directory entries skipped); test helper `buildZip(entries: {name: string, data: Buffer, method?: 0|8}[]) -> Buffer`

- [ ] **Step 1: Create the feature branch and the test helper**

```bash
cd /Users/mingqxu/Projects/bible-study-guidegen
git checkout -b feat/sword-ingest
mkdir -p corpus/test/helpers
```

Create `corpus/test/helpers/zip-builder.js`:

```js
import zlib from 'node:zlib';

// Minimal ZIP writer for tests. method 0 = stored, 8 = deflate (any other value is written
// into the headers as-is with the data stored, so tests can exercise "unsupported method").
export function buildZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data, method = 8 } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const crc = zlib.crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); // version made by
    cen.writeUInt16LE(20, 6); // version needed
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42); // local header offset
    central.push(cen, nameBuf);

    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}
```

- [ ] **Step 2: Write the failing test**

Create `corpus/test/zip.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readZip } from '../lib/zip.js';
import { buildZip } from './helpers/zip-builder.js';

test('readZip returns deflated and stored entries and skips directories', () => {
  const big = Buffer.from('hello sword '.repeat(500));
  const zip = buildZip([
    { name: 'mods.d/', data: Buffer.alloc(0), method: 0 },
    { name: 'mods.d/x.conf', data: Buffer.from('[X]\nModDrv=zCom\n'), method: 8 },
    { name: 'modules/big.bin', data: big, method: 8 },
    { name: 'plain.txt', data: Buffer.from('stored bytes'), method: 0 },
  ]);
  const files = readZip(zip);
  assert.deepEqual([...files.keys()].sort(), ['mods.d/x.conf', 'modules/big.bin', 'plain.txt']);
  assert.equal(files.get('mods.d/x.conf').toString(), '[X]\nModDrv=zCom\n');
  assert.deepEqual(files.get('modules/big.bin'), big);
  assert.equal(files.get('plain.txt').toString(), 'stored bytes');
});

test('readZip rejects an unsupported compression method', () => {
  const zip = buildZip([{ name: 'a.bin', data: Buffer.from('abc'), method: 12 }]);
  assert.throws(() => readZip(zip), /unsupported compression method 12/);
});

test('readZip reports a truncated archive (no end-of-central-directory)', () => {
  const zip = buildZip([{ name: 'a.txt', data: Buffer.from('abc') }]);
  assert.throws(() => readZip(zip.subarray(0, zip.length - 10)), /end-of-central-directory/);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/zip.js'`

- [ ] **Step 4: Implement `lib/zip.js`**

```js
import zlib from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

// Reads a whole ZIP held in memory. Supports stored (0) and deflate (8) entries, no ZIP64.
export function readZip(buf) {
  let eocd = -1;
  const lowest = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= lowest; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: end-of-central-directory record not found (truncated download?)');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) throw new Error('zip: bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;

    if (csize === 0xffffffff || usize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error(`zip: ZIP64 entries are not supported (${name})`);
    }
    if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw new Error(`zip: bad local header for ${name}`);
    const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(dataStart, dataStart + csize);

    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`zip: unsupported compression method ${method} for ${name}`);
    if (data.length !== usize) throw new Error(`zip: ${name} inflated to ${data.length} bytes, expected ${usize}`);
    files.set(name, data);
  }
  return files;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (32 existing + 3 new = 35).

- [ ] **Step 6: Commit**

```bash
git add corpus/lib/zip.js corpus/test/zip.test.js corpus/test/helpers/zip-builder.js
git commit -m "feat(corpus): in-memory ZIP reader (stored + deflate)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: KJV verse-slot layout

**Files:**
- Create: `corpus/lib/kjv.js`
- Test: `corpus/test/kjv.test.js`

**Interfaces:**
- Consumes: `bibleBounds` (`backend/services/bibleBounds.js`), `BOOKS` (`lib/books.js`)
- Produces: `TESTAMENT_BOOKS: {ot: string[], nt: string[]}` (repo book codes in canonical order); `versesIn(code, chapter) -> number`; `chapterCount(code) -> number`; `slotCount('ot'|'nt') -> number`; `verseSlot(code, chapter, verse) -> number` (0-based record index within that book's testament file); throws `kjv: no such verse ...` for an out-of-range verse

- [ ] **Step 1: Write the failing test**

Create `corpus/test/kjv.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TESTAMENT_BOOKS, versesIn, chapterCount, slotCount, verseSlot } from '../lib/kjv.js';

test('slot counts match the real SWORD KJV-layout modules (24115 OT, 8246 NT)', () => {
  assert.equal(slotCount('ot'), 24115);
  assert.equal(slotCount('nt'), 8246);
});

test('testament book lists split 39 / 27', () => {
  assert.equal(TESTAMENT_BOOKS.ot.length, 39);
  assert.equal(TESTAMENT_BOOKS.nt.length, 27);
  assert.equal(TESTAMENT_BOOKS.ot[0], 'gen');
  assert.equal(TESTAMENT_BOOKS.nt[0], 'mat');
});

test('verse slots line up with real module data', () => {
  assert.equal(verseSlot('gen', 1, 1), 4); // slots 0-1 headers, 2 book heading, 3 chapter heading
  assert.equal(verseSlot('gen', 1, 2), 5);
  assert.equal(verseSlot('isa', 55, 13), 19512);
  assert.equal(verseSlot('mal', 4, 6), slotCount('ot') - 1); // last record
  assert.equal(verseSlot('mat', 1, 1), 4); // NT file restarts at slot 0
  assert.equal(verseSlot('rev', 22, 21), slotCount('nt') - 1); // last record
});

test('Isaiah 55 has 13 verses (bibleBounds says 11; the KJV layout has 13)', () => {
  assert.equal(versesIn('isa', 55), 13);
  assert.equal(versesIn('isa', 54), 17);
  assert.equal(chapterCount('isa'), 66);
});

test('verseSlot rejects verses that do not exist', () => {
  assert.throws(() => verseSlot('gen', 1, 32), /no such verse/);
  assert.throws(() => verseSlot('gen', 51, 1), /no such verse/);
  assert.throws(() => verseSlot('nope', 1, 1), /unknown book/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../lib/kjv.js'`

- [ ] **Step 3: Implement `lib/kjv.js`**

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (35 + 5 = 40). If the OT count is 24113, the Isaiah override is missing or wrong.

- [ ] **Step 5: Commit**

```bash
git add corpus/lib/kjv.js corpus/test/kjv.test.js
git commit -m "feat(corpus): KJV verse-slot layout with Isaiah 55 correction

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: SWORD zCom reader

**Files:**
- Create: `corpus/sources/sword-reader.js`, `corpus/test/helpers/sword-fixtures.js`
- Test: `corpus/test/sword-reader.test.js`

**Interfaces:**
- Consumes: `verseSlot`, `chapterCount`, `versesIn`, `slotCount` (lib/kjv.js)
- Produces (`sword-reader.js`):
  - `parseConf(text) -> Record<string,string>`
  - `assertSupported(conf, moduleId?) -> void` (throws `Refusing <id>: ...`)
  - `cleanMarkup(raw) -> string`
  - `isStub(text) -> boolean`
  - `openTestament({zs, zv, zz}: Buffers, label?) -> { recordCount, locate(slot) -> {block, offset, size} | null, read(loc) -> string }`
  - `bookEntries(testament, code) -> Generator<{chapter, verseStart, endChapter, verseEnd, text}>`
- Produces (test helper `sword-fixtures.js`): `buildTestament(total, entries: {slots: number[], text: string}[], {pack?}) -> {zs, zv, zz}`; `buildModuleZip({id, blockType, ot, nt, pack, conf}) -> Buffer`

- [ ] **Step 1: Create the fixture helper**

Create `corpus/test/helpers/sword-fixtures.js`:

```js
import zlib from 'node:zlib';
import { slotCount } from '../../lib/kjv.js';
import { buildZip } from './zip-builder.js';

// Builds the three files of one zCom testament in memory.
// entries: [{ slots: number[], text: string }]. Every slot listed points at that entry
// (this is how SWORD stores a note that covers several verses). Unlisted slots are empty.
// pack: put all entries into ONE compressed block (exercises the in-block offset).
export function buildTestament(total, entries, { pack = false } = {}) {
  const raws = entries.map((e) => Buffer.from(e.text, 'utf8'));
  const blocks = pack ? [Buffer.concat(raws)] : raws;
  const zv = Buffer.alloc(total * 10);
  const zs = Buffer.alloc(blocks.length * 12);
  const compressed = [];
  let zOffset = 0;
  blocks.forEach((raw, i) => {
    const comp = zlib.deflateSync(raw);
    zs.writeUInt32LE(zOffset, i * 12);
    zs.writeUInt32LE(comp.length, i * 12 + 4);
    zs.writeUInt32LE(raw.length, i * 12 + 8);
    compressed.push(comp);
    zOffset += comp.length;
  });
  let running = 0;
  entries.forEach((e, i) => {
    const block = pack ? 0 : i;
    const offset = pack ? running : 0;
    running += raws[i].length;
    for (const slot of e.slots) {
      zv.writeUInt32LE(block, slot * 10);
      zv.writeUInt32LE(offset, slot * 10 + 4);
      zv.writeUInt16LE(raws[i].length, slot * 10 + 8);
    }
  });
  return { zs, zv, zz: Buffer.concat(compressed) };
}

// Builds a module ZIP like CrossWire's rawzip packages. `ot` / `nt` are entry lists (omit a
// testament to leave its files out, as Barnes does for the OT). `conf` overrides/removes keys
// (set a key to undefined to drop it).
export function buildModuleZip({ id, blockType = 'BOOK', ot, nt, pack = false, conf = {} }) {
  const ext = blockType === 'BOOK' ? 'bz' : 'cz';
  const dir = id.toLowerCase();
  const fields = {
    DataPath: `./modules/comments/zcom/${dir}/`,
    ModDrv: 'zCom',
    SourceType: 'ThML',
    BlockType: blockType,
    CompressType: 'ZIP',
    DistributionLicense: 'Public Domain',
    ...conf,
  };
  const confText = `[${id}]\n${Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')}\n`;
  const entries = [{ name: `mods.d/${dir}.conf`, data: Buffer.from(confText) }];
  for (const [testament, list] of [['ot', ot], ['nt', nt]]) {
    if (!list) continue;
    const { zs, zv, zz } = buildTestament(slotCount(testament), list, { pack });
    entries.push(
      { name: `modules/comments/zcom/${dir}/${testament}.${ext}s`, data: zs },
      { name: `modules/comments/zcom/${dir}/${testament}.${ext}v`, data: zv },
      { name: `modules/comments/zcom/${dir}/${testament}.${ext}z`, data: zz },
    );
  }
  return buildZip(entries);
}
```

- [ ] **Step 2: Write the failing test**

Create `corpus/test/sword-reader.test.js`:

```js
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../sources/sword-reader.js'`

- [ ] **Step 4: Implement `sources/sword-reader.js`**

```js
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

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

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
    .replace(/[ \t\u00a0]+/g, ' ')
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (40 + 8 = 48). If an `assertSupported` case fails, check that the thrown message starts with `Refusing <id>:`.

- [ ] **Step 6: Commit**

```bash
git add corpus/sources/sword-reader.js corpus/test/sword-reader.test.js corpus/test/helpers/sword-fixtures.js
git commit -m "feat(corpus): SWORD zCom reader (conf guard, markup cleaning, verse-run grouping)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: SWORD ingest adapter

**Files:**
- Modify: `corpus/lib/licenses.js` (append `SWORD_MODULES`)
- Create: `corpus/sources/sword.js`
- Test: `corpus/test/sword.test.js`

**Interfaces:**
- Consumes: `readZip` (lib/zip.js); `TESTAMENT_BOOKS` (lib/kjv.js); `parseConf`, `assertSupported`, `cleanMarkup`, `isStub`, `openTestament`, `bookEntries` (sources/sword-reader.js); `replacePassages`, `upsertSource` (lib/db.js); a fetcher object with `fetch(url, {as: 'response'}) -> {body: ReadableStream}`; test helpers `buildModuleZip`, `verseSlot`
- Produces: `SWORD_MODULES: Record<'Wesley'|'Barnes'|'Luther', {id, name, author, notes}>`; `ingestSword(db, fetcher, {moduleId, cacheDir, baseUrl?, now?, log?}) -> {testaments: string[], books: number, rows: number}`

- [ ] **Step 1: Add `SWORD_MODULES` to `lib/licenses.js`**

Append to `corpus/lib/licenses.js`:

```js

// Key = CrossWire module id (the rawzip package name). `id` is our stable commentary_id.
export const SWORD_MODULES = {
  Wesley: { id: 'wesley', name: "Wesley's Notes on the Bible", author: 'John Wesley', notes: null },
  Barnes: { id: 'barnes', name: "Barnes' Notes on the Bible", author: 'Albert Barnes', notes: 'New Testament only' },
  Luther: { id: 'luther', name: "Luther's Commentary (selected passages)", author: 'Martin Luther', notes: 'selected passages only' },
};
```

- [ ] **Step 2: Write the failing test**

Create `corpus/test/sword.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';
import { verseSlot as s } from '../lib/kjv.js';
import { ingestSword } from '../sources/sword.js';
import { buildModuleZip } from './helpers/sword-fixtures.js';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'corpus-sword-'));
const rows = (db) => db.prepare(
  'SELECT commentary_id AS c, book, chapter, verse_start AS vs, end_chapter AS ec, verse_end AS ve, text, license, source FROM passages ORDER BY book, chapter, verse_start',
).all().map((r) => ({ ...r }));

function fakeFetcher(zipBuf) {
  const calls = [];
  return {
    calls,
    async fetch(url, opts) {
      calls.push([url, opts]);
      return { body: new Response(zipBuf).body };
    },
  };
}

const wesleyZip = () => buildModuleZip({
  id: 'Wesley',
  ot: [
    { slots: [s('gen', 1, 1)], text: '<p>Alpha</p>' },
    { slots: [s('gen', 1, 2), s('gen', 1, 3)], text: 'Beta<br />line two' },
  ],
  nt: [{ slots: [s('mat', 1, 1)], text: 'Gamma &amp; delta' }],
});

test('ingests both testaments, groups shared notes, cleans markup, records license and source', async () => {
  const db = openDb();
  const fetcher = fakeFetcher(wesleyZip());
  const stats = await ingestSword(db, fetcher, { moduleId: 'Wesley', cacheDir: await tmp(), now: () => 'T' });
  assert.deepEqual(stats, { testaments: ['ot', 'nt'], books: 2, rows: 3 });
  assert.deepEqual(rows(db), [
    { c: 'wesley', book: 'gen', chapter: 1, vs: 1, ec: 1, ve: 1, text: 'Alpha', license: 'Public Domain', source: 'sword' },
    { c: 'wesley', book: 'gen', chapter: 1, vs: 2, ec: 1, ve: 3, text: 'Beta\nline two', license: 'Public Domain', source: 'sword' },
    { c: 'wesley', book: 'mat', chapter: 1, vs: 1, ec: 1, ve: 1, text: 'Gamma & delta', license: 'Public Domain', source: 'sword' },
  ]);
  const src = db.prepare('SELECT name, license, source, source_url FROM sources WHERE commentary_id = ?').get('wesley');
  assert.equal(src.license, 'Public Domain');
  assert.equal(src.source, 'sword');
  assert.equal(src.source_url, 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Wesley.zip');
  assert.equal(fetcher.calls[0][1].as, 'response');
});

test('second run is served from the cached ZIP and leaves the same rows', async () => {
  const db = openDb();
  const fetcher = fakeFetcher(wesleyZip());
  const cacheDir = await tmp();
  await ingestSword(db, fetcher, { moduleId: 'Wesley', cacheDir });
  const first = rows(db);
  await ingestSword(db, fetcher, { moduleId: 'Wesley', cacheDir });
  assert.equal(fetcher.calls.length, 1);
  assert.deepEqual(rows(db), first);
});

test('a rerun replaces the module rows instead of leaving stale ones', async () => {
  const db = openDb();
  const cacheDir = await tmp();
  await ingestSword(db, fakeFetcher(wesleyZip()), { moduleId: 'Wesley', cacheDir });
  await fs.rm(path.join(cacheDir, 'Wesley.zip'));
  const smaller = buildModuleZip({ id: 'Wesley', ot: [{ slots: [s('gen', 1, 1)], text: 'Only' }] });
  await ingestSword(db, fakeFetcher(smaller), { moduleId: 'Wesley', cacheDir });
  assert.deepEqual(rows(db).map((r) => [r.book, r.vs, r.text]), [['gen', 1, 'Only']]);
});

test('Barnes: NT-only module, "no text" stubs dropped, BlockType CHAPTER read from .cz files', async () => {
  const db = openDb();
  const zip = buildModuleZip({
    id: 'Barnes', blockType: 'CHAPTER',
    nt: [
      { slots: [s('mat', 1, 4)], text: 'Verse 4. No specific Barnes text on this verse. <scripRef passage="Mt 1:3">Mt 1:3</scripRef>.' },
      { slots: [s('mat', 1, 5)], text: 'A real Barnes note' },
    ],
  });
  const stats = await ingestSword(db, fakeFetcher(zip), { moduleId: 'Barnes', cacheDir: await tmp() });
  assert.deepEqual(stats, { testaments: ['nt'], books: 1, rows: 1 });
  assert.deepEqual(rows(db).map((r) => [r.c, r.book, r.vs, r.text]), [['barnes', 'mat', 5, 'A real Barnes note']]);
  assert.equal(db.prepare('SELECT notes FROM sources WHERE commentary_id = ?').get('barnes').notes, 'New Testament only');
});

test('Luther: a note spanning chapters becomes one row with end_chapter', async () => {
  const db = openDb();
  const zip = buildModuleZip({
    id: 'Luther', blockType: 'CHAPTER', conf: { SourceType: 'OSIS' },
    ot: [{ slots: [s('gen', 1, 31), s('gen', 2, 1), s('gen', 2, 2)], text: '<div sID="a"/>Long note<div eID="a"/>' }],
  });
  await ingestSword(db, fakeFetcher(zip), { moduleId: 'Luther', cacheDir: await tmp() });
  assert.deepEqual(rows(db).map((r) => [r.chapter, r.vs, r.ec, r.ve, r.text]), [[1, 31, 2, 2, 'Long note']]);
});

test('refuses a module that is not public domain before writing anything', async () => {
  const db = openDb();
  const zip = buildModuleZip({ id: 'Wesley', ot: [{ slots: [s('gen', 1, 1)], text: 'x' }], conf: { DistributionLicense: 'Copyrighted' } });
  await assert.rejects(ingestSword(db, fakeFetcher(zip), { moduleId: 'Wesley', cacheDir: await tmp() }), /Refusing Wesley.*Public Domain/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM passages').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sources').get().n, 0);
});

test('a corrupt cached ZIP tells you which file to delete', async () => {
  const cacheDir = await tmp();
  await fs.writeFile(path.join(cacheDir, 'Wesley.zip'), Buffer.from('not a zip'));
  await assert.rejects(
    ingestSword(openDb(), fakeFetcher(Buffer.alloc(0)), { moduleId: 'Wesley', cacheDir }),
    (e) => /end-of-central-directory/.test(e.message) && e.message.includes(path.join(cacheDir, 'Wesley.zip')),
  );
});

test('a module with no data files is an error, not an empty success', async () => {
  const zip = buildModuleZip({ id: 'Wesley' });
  await assert.rejects(ingestSword(openDb(), fakeFetcher(zip), { moduleId: 'Wesley', cacheDir: await tmp() }), /no ot\/nt data files/);
});

test('unknown module id is rejected without fetching', async () => {
  const fetcher = fakeFetcher(Buffer.alloc(0));
  await assert.rejects(ingestSword(openDb(), fetcher, { moduleId: 'Nope', cacheDir: await tmp() }), /Unknown SWORD module/);
  assert.equal(fetcher.calls.length, 0);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd corpus && npm test`
Expected: FAIL, `Cannot find module '../sources/sword.js'`

- [ ] **Step 4: Implement `sources/sword.js`**

```js
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd corpus && npm test`
Expected: all tests PASS (48 + 9 = 57).

- [ ] **Step 6: Commit**

```bash
git add corpus/lib/licenses.js corpus/sources/sword.js corpus/test/sword.test.js
git commit -m "feat(corpus): SWORD ingest adapter (Wesley, Barnes, Luther)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: CLI, README, offline checks

**Files:**
- Modify: `corpus/cli.js`, `corpus/README.md`

**Interfaces:**
- Consumes: `ingestSword` (sources/sword.js), `SWORD_MODULES` (lib/licenses.js), `createFetcher({hostIntervals})` (lib/fetcher.js)
- Produces: CLI command `ingest sword [--commentary Wesley|Barnes|Luther]`

- [ ] **Step 1: Edit `corpus/cli.js`**

Change the licenses import and add the sword import:

```js
import { HELLOAO_COMMENTARIES, SWORD_MODULES } from './lib/licenses.js';
```
```js
import { ingestHelloao } from './sources/helloao.js';
import { ingestSword } from './sources/sword.js';
```

Replace `makeFetcher` so it accepts per-host intervals:

```js
function makeFetcher(minIntervalMs, hostIntervals = {}) {
  // CORPUS_CONTACT is optional: when set it is appended to the User-Agent so servers can reach you.
  const contact = process.env.CORPUS_CONTACT;
  return createFetcher({
    userAgent: contact
      ? `bible-commentary-corpus/0.1 (research; contact: ${contact})`
      : 'bible-commentary-corpus/0.1 (research)',
    minIntervalMs,
    hostIntervals,
  });
}
```

Add this branch in `main()` directly after the `helloao` branch:

```js
  if (command === 'ingest' && source === 'sword') {
    const db = openDb(values.db);
    // CrossWire's robots.txt asks for Crawl-delay: 30. We only ever request the module ZIPs.
    const fetcher = makeFetcher(0, { 'www.crosswire.org': 30000 });
    const ids = values.commentary ? [values.commentary] : Object.keys(SWORD_MODULES);
    for (const moduleId of ids) {
      const stats = await ingestSword(db, fetcher, {
        moduleId, cacheDir: path.join(here, 'cache', 'sword'), log: (m) => console.error(m),
      });
      console.log(moduleId, JSON.stringify(stats));
    }
    return;
  }
```

Update the usage string to:

```js
  console.error('Usage: cli.js ingest helloao [--commentary <helloao-id>] [--book ROM ...] | ingest sword [--commentary Wesley|Barnes|Luther] | report  [--db path]');
```

- [ ] **Step 2: Edit `corpus/README.md`**

Change the first paragraph's source list to `(currently HelloAO and CrossWire SWORD modules)`, add this line after the `helloao` commands in the code block:

```
npm run ingest -- sword                      # Wesley, Barnes (NT), Luther (selected passages); ~11 MB, one ZIP per 30 s
```

and replace the "Not included yet" paragraph with:

```
Not included yet: Lapide, Gill, Benson, Whedon, Bengel, Kretzmann, Haydock, Darby's Synopsis
(no bulk source found), and the SWORD versions of Clarke/Calvin/MHC/JFB (HelloAO already supplies
those; SWORD could fill their gaps). The copyrighted commentaries (Scofield, Ironside, McGee,
Constable, Orchard) are out of scope.

SWORD notes: modules are read with a built-in reader (no SWORD library). Book and chapter intro
headings are not ingested; Barnes' preface/introduction sit in the Matt 1:1/1:2 verse slots and
are stored as ordinary verse rows. Barnes "no specific text" placeholders are dropped.
```

- [ ] **Step 3: Verify offline (no network)**

Run: `cd corpus && npm test`
Expected: all 57 tests PASS.

Run: `cd corpus && node --disable-warning=ExperimentalWarning cli.js ingest sword --commentary Nope --db "$(mktemp -u)-plan-check.sqlite"; echo "exit=$?"`
Expected: prints `Error: Unknown SWORD module: Nope` and `exit=1`, with no network request (it fails before fetching).

Run: `cd corpus && node --disable-warning=ExperimentalWarning cli.js 2>&1 | head -1`
Expected: the usage line now mentions `ingest sword`.

Do NOT run `ingest sword` for a real module in this task. The live run (Step 5) is the controller's, with the user's go-ahead.

- [ ] **Step 4: Commit**

```bash
git add corpus/cli.js corpus/README.md
git commit -m "feat(corpus): ingest sword command and README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Live run (controller/user only; not a subagent step)**

Run: `cd corpus && npm run ingest -- sword` (three ZIP downloads, at least 30 s apart, about 11 MB total). If any request returns 403 (exit code 3), stop; do not retry or change headers.

Then verify against real data, in this order:

1. Each line prints `{"testaments":[...],"books":N,"rows":M}`: Wesley `["ot","nt"]`, Barnes `["nt"]`, Luther `["ot","nt"]`.
2. `npm run report` lists `wesley`, `barnes`, `luther` with `sword` and `Public Domain`; Barnes shows all OT books missing.
3. Spot-check text: `SELECT substr(text,1,120) FROM passages WHERE commentary_id='wesley' AND book='gen' AND chapter=1 AND verse_start=1` returns Wesley's "Observe here. 1. The effect produced..." text with no `<` tags left.
4. Luther has a cross-chapter row: `SELECT COUNT(*) FROM passages WHERE commentary_id='luther' AND end_chapter > chapter` is greater than 0.
5. Row counts are below the non-empty slot counts (Wesley NT: 5,631 slots, 5,562 distinct entries) because shared notes collapse; if Wesley NT rows are far below ~5,500, inspect grouping.
6. No stray markup: `SELECT COUNT(*) FROM passages WHERE source='sword' AND (text LIKE '%<%' OR text LIKE '%&amp;%')` should be 0 or explained (a literal `<` in a note).

---

## Self-Review Notes

- **Spec coverage:** ZIP reader (Task 1); KJV layout with the Isaiah 55 correction and slot-count check (Task 2); conf/license/driver guards, markup cleaning, stub filter, block/verse index reading, cross-chapter run grouping, corrupt-index errors (Task 3); download + cache + `.partial` rename, `upsertSource`, single `replacePassages`, NT-only modules, missing-data error, unknown module (Task 4); `ingest sword` with the 30 s CrossWire host interval and only ZIP URLs, README limits (Task 5); manual live spot-checks (Task 5 Step 5).
- **Placeholders:** none. The only run-time value is the optional `CORPUS_CONTACT`.
- **Type consistency:** `openTestament` returns `{recordCount, locate, read}` and `bookEntries`/`ingestSword` use exactly those; `bookEntries` yields `{chapter, verseStart, endChapter, verseEnd, text}` and `ingestSword` maps it to the row shape `{commentaryId, source, book, chapter, verseStart, endChapter, verseEnd, seq, text, license, fetchedAt}` used by `db.js`.
- **Known limits carried to the report:** intro heading slots skipped; text-embedded range headers not parsed; Barnes preface stored as Matt 1:1/1:2 rows.
