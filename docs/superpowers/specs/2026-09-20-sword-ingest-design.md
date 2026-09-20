# SWORD Module Ingestion: Design

Date: 2026-09-20
Status: Draft for review
Extends: `2026-09-20-commentary-corpus-design.md` (adds one source adapter to the `corpus/` package)

## Goal

Add Wesley's Notes, Barnes' Notes and Luther (selected passages) to the corpus from CrossWire
SWORD modules, using a zero-dependency pure-Node reader. Same `passages` row shape, license
guard and politeness rules as the HelloAO adapter.

## Scope

In: modules `Wesley` (OT+NT), `Barnes` (NT only), `Luther` (OT+NT, selected passages).
Out (for now): Clarke, Calvin, MHC, JFB from SWORD (HelloAO already supplies them; filling their
gaps needs a merge rule and is a separate decision). Lapide, Gill, Benson, Whedon, Bengel,
Kretzmann, Haydock (not in CrossWire's package index). Book and chapter intro slots (see below).
Drivers other than `zCom` (the three modules all use the 10-byte-record `zCom` driver; the
reader throws on anything else instead of guessing).

## Source facts (verified against the real module ZIPs on 2026-09-20)

- Download: `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/<id>.zip`
  (Wesley 1.9 MB, Barnes 5.8 MB, Luther 3.0 MB). ZIP entries are deflate-compressed.
- Each ZIP holds `mods.d/<id>.conf` and `modules/comments/zcom/<id>/{ot,nt}.{bzs,bzv,bzz}`
  (`BlockType=BOOK`, Wesley) or `.czs/.czv/.czz` (`BlockType=CHAPTER`, Barnes and Luther).
- All three: `ModDrv=zCom`, `CompressType=ZIP` (zlib), `Encoding=UTF-8`,
  `DistributionLicense=Public Domain`, no `Versification` line (KJV layout).
- Wesley and Barnes are ThML; Luther is OSIS.
- `.?zs` block index: 12-byte records, three little-endian uint32: offset in `.?zz`,
  compressed size, uncompressed size. `.?zz` block = `zlib.inflateSync(z[off .. off+csize])`.
- `.?zv` verse index: 10-byte records, uint32 block number, uint32 offset inside the inflated
  block, uint16 size. Size 0 = empty. Record counts: OT 24115, NT 8246.
- Slot for verse (book b, chapter c, verse v), 0-based:
  `2 + Σ_{prev books}(1 + Σ chapters(1 + nverses)) + 1 + Σ_{prev chapters in b}(1 + nverses) + 1 + (v-1)`.
  Slots 0-1 are module/testament headers; each book has a book heading, each chapter a chapter
  heading. Gen 1:1 is slot 4.
- A note for a verse range is stored once; every verse slot in the range points at the same
  `(block, offset, size)` triple.

## Design

New files in `corpus/` (existing files untouched except `cli.js`, `lib/licenses.js`, `README.md`):

```
corpus/lib/zip.js              # readZip(buffer) -> Map(name -> Buffer); central-directory + inflateRawSync
corpus/lib/kjv.js              # verseSlot(book, chapter, verse), slotCount(testament) from bibleBounds
corpus/sources/sword.js        # parseConf, readModule, cleanMarkup, ingestSword
corpus/test/{zip,kjv,sword}.test.js
```

- **`zip.js`**: parses the end-of-central-directory record and central directory, returns
  decompressed entries by name. Supports stored and deflate entries; anything else throws.
- **`kjv.js`**: builds the slot table from `backend/services/bibleBounds.js` (per-book, per-chapter
  verse counts) plus a one-entry override: `bibleBounds` has Isaiah 55 as 11 verses, the KJV (and
  the module layout) has 13. Without the override the OT is 2 slots short (24113, not 24115). A
  test asserts the derived slot counts equal 24115 (OT) and 8246 (NT), and that the last verse of
  each testament (Mal 4:6, Rev 22:21) is the last record. The bug is in the app's table, not in the
  corpus; `backend/` is left untouched and the override lives in `corpus/lib/kjv.js`.
- **`sword.js`**:
  - `parseConf(text)`: reads `key=value` fields (`ModDrv`, `BlockType`, `CompressType`,
    `SourceType`, `Encoding`, `DistributionLicense`, `Versification`).
  - License guard: refuse unless `DistributionLicense` is "Public Domain"; refuse unsupported
    `ModDrv`, `CompressType`, `BlockType`, a present non-UTF-8 `Encoding` (Wesley's conf has no
    `Encoding` line; absent is treated as UTF-8) or a present, non-KJV `Versification`.
  - `readModule(files, conf)`: for each testament file set, decode blocks lazily (inflate each
    block once, cache it) and, for every verse in every book/chapter, read its slot, skipping
    empty (size 0) records. Consecutive verse slots in reading order within a book, across chapter
    boundaries, that share the same `(block, offset, size)` become one entry
    `{chapter, verseStart, endChapter, verseEnd}`. (Verified on Luther, where one note is pointed at
    by every verse of e.g. Gen 1:1-4:7; grouping per chapter would repeat that text per chapter.)
    Book/chapter heading slots between verses are skipped and do not break a group.
  - `cleanMarkup(text, sourceType)`: turn `<br/>`, `</p>`, `<div type="x-p">`, `</title>` into
    newlines, drop all remaining tags, decode entities, collapse whitespace, trim.
  - Drop entries whose cleaned text is empty or is a "no text" stub (Barnes: text matching
    `/No specific Barnes text on this verse/`), so coverage reports honest gaps.
  - `ingestSword(db, fetcher, {moduleId, cacheDir, baseUrl, now, log})`: download the ZIP if not
    cached (cache file written to `.partial` then renamed), `upsertSource`, then one
    `replacePassages` for the whole module (so a rerun after a parser change leaves no stale rows).
    Returns `{ testaments, books, rows }`.
- **Ids/licenses**: `lib/licenses.js` gains `SWORD_MODULES = { Wesley: {id:'wesley', ...}, Barnes:
  {id:'barnes', ...}, Luther: {id:'luther', ...} }`. Row `license` is the conf's
  `DistributionLicense` string; source is `'sword'`.
- **CLI**: `ingest sword [--commentary Wesley|Barnes|Luther]` (default all three). One fetcher
  with `hostIntervals: { 'www.crosswire.org': 30000 }`, so consecutive ZIP downloads are at
  least 30 s apart, honoring CrossWire's `Crawl-delay: 30`. Only the three ZIP URLs are ever
  requested; no crawling, nothing under `/study/` or `raw/modules/`.

### Explicitly skipped in v1 (recorded in the report as known limits)

- Book intro and chapter intro heading slots (they exist in the data but are not verse commentary).
  Note: Barnes stores its preface and introduction in the Matt 1:1 and 1:2 *verse* slots, so those
  are ingested as ordinary verse-1 rows; this is accepted in v1.
- Range boundaries stated inside the text ("Verses 2-16", Luther's `annotateRef`): v1 uses the
  verse slots that share an entry, which the research showed matches the module's own grouping.
  A `report`-visible spot-check on the live run decides whether parsing text ranges is needed.

## Error handling

Any HTTP 403 stops the run (existing `BlockedError`, exit 3). Unsupported driver, license or
versification throws before any row is written. A slot whose block index is out of range or whose
inflated length disagrees with the index throws with the module id and slot number (a corrupt
download is loud, not silently truncated). A truncated cached ZIP fails `readZip` and the message
says to delete `cache/sword/<id>.zip`.

## Testing

- `zip.test.js`: build a tiny ZIP in the test (stored and deflate entries) and read it back; an
  unsupported compression method throws.
- `kjv.test.js`: slot counts 24115 / 8246; Gen 1:1 is slot 4; Matt 1:1 is the first NT verse slot
  after its headers.
- `sword.test.js`: synthesize a small module (zlib-compress a few blocks, write `.bzs/.bzv/.bzz`
  buffers in memory) and assert: decoded text per verse, range dedupe (three slots, one entry,
  `verseStart..verseEnd`), empty slots skipped, Barnes stub dropped, ThML and OSIS cleaning,
  license/driver guards, and idempotent re-ingest (row count unchanged).
- Live run (manual, user-run like the HelloAO smoke test): ingest Wesley, then check that
  Gen 1:1 has text, that Luther has at least one row whose `end_chapter` is greater than its
  `chapter` (a cross-chapter range), and that `npm run report` shows Wesley/Barnes/Luther
  coverage (Barnes NT only, Luther partial). Row counts should be below the count of non-empty
  verse slots (Wesley NT: 5,631 slots, 5,562 distinct entries) because shared entries collapse.

## Open items

- None blocking. If the live spot-check shows in-text range headers disagree with the shared-slot
  grouping, a follow-up adds range-header parsing.
