import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS, USFM_TO_CODE } from '../lib/books.js';
import { bibleBounds } from '../../backend/services/bibleBounds.js';

// Book ids returned by HelloAO's john-gill books.json (verified live 2026-09-20).
const HELLOAO_IDS =
  'GEN,EXO,LEV,NUM,DEU,JOS,JDG,RUT,1SA,2SA,1KI,2KI,1CH,2CH,EZR,NEH,EST,JOB,PSA,PRO,ECC,SNG,ISA,JER,LAM,EZK,DAN,HOS,JOL,AMO,OBA,JON,MIC,NAM,HAB,ZEP,HAG,ZEC,MAL,MAT,MRK,LUK,JHN,ACT,ROM,1CO,2CO,GAL,EPH,PHP,COL,1TH,2TH,1TI,2TI,TIT,PHM,HEB,JAS,1PE,2PE,1JN,2JN,3JN,JUD,REV'.split(',');

test('66 books with unique codes and usfm ids', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(new Set(BOOKS.map((b) => b.code)).size, 66);
  assert.equal(new Set(BOOKS.map((b) => b.usfm)).size, 66);
});

test('every code exists in the app bibleBounds table', () => {
  for (const b of BOOKS) assert.ok(bibleBounds[b.code], `missing in bibleBounds: ${b.code}`);
});

test('every HelloAO book id maps to a code', () => {
  for (const id of HELLOAO_IDS) assert.ok(USFM_TO_CODE[id], `unmapped USFM id: ${id}`);
  assert.equal(HELLOAO_IDS.length, 66);
});

test('spot-check the maps', () => {
  assert.equal(USFM_TO_CODE.PHP, 'phi');
  assert.equal(USFM_TO_CODE.JHN, 'joh');
  assert.equal(USFM_TO_CODE.EZK, 'eze');
});
