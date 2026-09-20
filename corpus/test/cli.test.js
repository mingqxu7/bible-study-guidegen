import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, upsertPassages, upsertSource } from '../lib/db.js';

const cli = new URL('../cli.js', import.meta.url).pathname;

function seededFile() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-cli-')), 'c.sqlite');
  const db = openDb(file);
  upsertSource(db, { commentaryId: 'gill', name: "Gill's Exposition", author: 'John Gill', source: 'helloao', license: 'PD' });
  upsertPassages(db, [{
    commentaryId: 'gill', source: 'helloao', book: 'rom', chapter: 8, verseStart: 28, endChapter: 8, verseEnd: 28,
    seq: 0, text: 'A short English note.', license: 'PD', fetchedAt: 'T',
  }]);
  db.close();
  return file;
}

function run(args, env = {}) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ANTHROPIC_API_KEY: '', ...env },
  });
}

test('translate without ANTHROPIC_API_KEY exits 2 with a clear message', () => {
  const r = run(['translate', 'gill', 'rom', '8:28', '--db', seededFile()]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ANTHROPIC_API_KEY/);
});

test('translate --dry-run needs no key and reports counts', () => {
  const r = run(['translate', 'gill', 'rom', '8:28', '--dry-run', '--db', seededFile()]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Matched 1 passage\(s\): 0 already translated, 1 to translate/);
  assert.match(r.stdout, /Estimate \(rough\)/);
});

test('an unknown commentary is a usage error with exit 1', () => {
  const r = run(['translate', 'nope', 'rom', '8', '--dry-run', '--db', seededFile()]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown commentary "nope"/);
});

test('show works without a key and says there is no translation yet', () => {
  const r = run(['show', 'gill', 'rom', '8:28', '--db', seededFile()]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /A short English note\./);
  assert.match(r.stdout, /\(no translation yet\)/);
});

test('translations report works on a database with none', () => {
  const r = run(['translations', 'report', '--db', seededFile()]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /No translations yet\./);
});

test('the usage line mentions the new commands', () => {
  const r = run([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /translate/);
  assert.match(r.stderr, /show/);
  assert.match(r.stderr, /translations report/);
});
