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
