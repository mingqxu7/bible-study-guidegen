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
