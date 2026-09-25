import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, upsertSource, setAccess, getAccess } from '../lib/db.js';
import { formatReport } from '../lib/report.js';
import { UsageError, runAccess } from '../lib/commands.js';

const src = (over = {}) => ({
  commentaryId: 'henry', name: 'Matthew Henry', author: 'Matthew Henry', source: 'helloao',
  license: 'PD', ...over,
});
const fileDb = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-access-')), 'c.sqlite');
const lines = () => { const out = []; return { out, log: (s) => out.push(s) }; };

test('a source is open unless it is restricted', () => {
  const db = openDb();
  upsertSource(db, src());
  assert.equal(getAccess(db, 'henry'), 'open');
});

test('an older database without the access column gains it on open', () => {
  const file = fileDb();
  const a = openDb(file);
  upsertSource(a, src());
  a.exec('ALTER TABLE sources DROP COLUMN access');
  a.close();
  const b = openDb(file);
  assert.equal(getAccess(b, 'henry'), 'open'); // existing rows default to open
  b.close();
});

test('upsertSource stores an explicit access value', () => {
  const db = openDb();
  upsertSource(db, src({ access: 'restricted' }));
  assert.equal(getAccess(db, 'henry'), 'restricted');
});

test('re-ingesting a source does NOT silently reopen it', () => {
  const db = openDb();
  upsertSource(db, src());
  setAccess(db, 'henry', 'restricted');
  upsertSource(db, src({ name: 'Matthew Henry Commentary' })); // an ingest run: no access passed
  assert.equal(getAccess(db, 'henry'), 'restricted');
  assert.equal(db.prepare('SELECT name FROM sources WHERE commentary_id = ?').get('henry').name, 'Matthew Henry Commentary');
});

test('setAccess flips a source both ways and rejects a bad value or an unknown id', () => {
  const db = openDb();
  upsertSource(db, src());
  setAccess(db, 'henry', 'restricted');
  assert.equal(getAccess(db, 'henry'), 'restricted');
  setAccess(db, 'henry', 'open');
  assert.equal(getAccess(db, 'henry'), 'open');
  assert.throws(() => setAccess(db, 'henry', 'paid'), /open.*restricted/);
  assert.throws(() => setAccess(db, 'nope', 'restricted'), /Unknown commentary/);
  assert.equal(getAccess(db, 'nope'), null);
});

test('the report marks restricted sources and leaves open ones unchanged', () => {
  const db = openDb();
  upsertSource(db, src());
  upsertSource(db, src({ commentaryId: 'henry-concise', name: "Henry's Concise", source: 'sword', license: 'Public Domain' }));
  setAccess(db, 'henry', 'restricted');
  const text = formatReport(db);
  assert.match(text, /^henry {2}\[helloao\] {2}PD {2}access: restricted$/m);
  assert.match(text, /^henry-concise {2}\[sword\] {2}Public Domain$/m);
});

test('runAccess sets the flag, reports what it did, and refuses bad input', () => {
  const db = openDb();
  upsertSource(db, src());
  const { out, log } = lines();
  runAccess({ db, commentary: 'henry', access: 'restricted', log });
  assert.deepEqual(out, ['henry: access set to restricted']);
  assert.equal(getAccess(db, 'henry'), 'restricted');
  assert.throws(() => runAccess({ db, commentary: 'henry', access: 'paid', log }), UsageError);
  assert.throws(() => runAccess({ db, commentary: 'nope', access: 'open', log }), UsageError);
});
