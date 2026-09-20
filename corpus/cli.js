#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { openDb } from './lib/db.js';
import { BlockedError, createFetcher } from './lib/fetcher.js';
import { HELLOAO_COMMENTARIES, SWORD_MODULES } from './lib/licenses.js';
import { formatReport } from './lib/report.js';
import { ingestHelloao } from './sources/helloao.js';
import { ingestSword } from './sources/sword.js';
import { AuthError, createClient } from './lib/anthropic.js';
import { UsageError, runShow, runTranslate, runTranslationsReport } from './lib/commands.js';
import { DEFAULT_MODEL } from './lib/translate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: path.join(here, 'corpus.sqlite') },
    commentary: { type: 'string' },
    book: { type: 'string', multiple: true },
    concurrency: { type: 'string', default: '2' },
    model: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'max-chars': { type: 'string', default: '30000' },
  },
});
const [command, source] = positionals;

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

async function main() {
  if (command === 'report') {
    console.log(formatReport(openDb(values.db)));
    return;
  }
  if (command === 'translate') {
    const [, commentary, book, ref] = positionals;
    if (!commentary || !book || !ref) {
      throw new UsageError('Usage: translate <commentary> <book> <chapter>[:<verse>] [--model id] [--force] [--dry-run] [--max-chars n]');
    }
    const maxChars = Number(values['max-chars']);
    if (!Number.isInteger(maxChars) || maxChars < 1) throw new UsageError('--max-chars must be a positive integer');
    const model = values.model ?? DEFAULT_MODEL;
    const dryRun = values['dry-run'];
    let client = null;
    if (!dryRun) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('Set ANTHROPIC_API_KEY in your environment to translate (use --dry-run to preview without a key).');
        process.exit(2);
      }
      client = createClient({ apiKey, model });
    }
    process.exitCode = await runTranslate({
      db: openDb(values.db), client, model, commentary, book, ref,
      force: values.force, dryRun, maxChars,
    });
    return;
  }
  if (command === 'show') {
    const [, commentary, book, ref] = positionals;
    if (!commentary || !book || !ref) throw new UsageError('Usage: show <commentary> <book> <chapter>[:<verse>] [--model id]');
    runShow({ db: openDb(values.db), model: values.model ?? DEFAULT_MODEL, commentary, book, ref });
    return;
  }
  if (command === 'translations' && source === 'report') {
    runTranslationsReport({ db: openDb(values.db) });
    return;
  }
  if (command === 'ingest' && source === 'helloao') {
    const db = openDb(values.db);
    const fetcher = makeFetcher(200); // <= 5 req/s across all workers
    const ids = values.commentary ? [values.commentary] : Object.keys(HELLOAO_COMMENTARIES);
    for (const helloaoId of ids) {
      const stats = await ingestHelloao(db, fetcher, {
        helloaoId, cacheDir: path.join(here, 'cache', 'helloao'), books: values.book ?? null,
        concurrency: Number(values.concurrency), log: (m) => console.error(m),
      });
      console.log(helloaoId, JSON.stringify(stats));
    }
    return;
  }
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
  console.error('Usage: cli.js ingest helloao [--commentary <helloao-id>] [--book ROM ...] | ingest sword [--commentary Wesley|Barnes|Luther] | report | translate <commentary> <book> <chapter>[:<verse>] [--model id] [--force] [--dry-run] [--max-chars n] | show <commentary> <book> <chapter>[:<verse>] [--model id] | translations report  [--db path]');
  process.exit(1);
}

main().catch((err) => {
  const quiet = err instanceof BlockedError || err instanceof AuthError || err instanceof UsageError;
  console.error(quiet ? err.message : err);
  process.exit(err instanceof BlockedError || err instanceof AuthError ? 3 : 1);
});
