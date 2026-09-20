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
