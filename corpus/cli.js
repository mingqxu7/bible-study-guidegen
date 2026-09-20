#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { openDb } from './lib/db.js';
import { BlockedError, createFetcher } from './lib/fetcher.js';
import { HELLOAO_COMMENTARIES } from './lib/licenses.js';
import { formatReport } from './lib/report.js';
import { downloadRelease, ingestHcf } from './sources/hcf.js';
import { ingestHelloao } from './sources/helloao.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: 'string', default: path.join(here, 'corpus.sqlite') },
    commentary: { type: 'string' },
    book: { type: 'string', multiple: true },
    concurrency: { type: 'string', default: '2' },
  },
});
const [command, source] = positionals;

function makeFetcher(minIntervalMs) {
  // CORPUS_CONTACT is optional: when set it is appended to the User-Agent so servers can reach you.
  const contact = process.env.CORPUS_CONTACT;
  return createFetcher({
    userAgent: contact
      ? `bible-commentary-corpus/0.1 (research; contact: ${contact})`
      : 'bible-commentary-corpus/0.1 (research)',
    minIntervalMs,
  });
}

async function main() {
  if (command === 'report') {
    console.log(formatReport(openDb(values.db)));
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
  if (command === 'ingest' && source === 'hcf') {
    const db = openDb(values.db);
    const dest = path.join(here, 'cache', 'hcf', 'commentaries.sqlite');
    await downloadRelease(makeFetcher(1000), dest);
    console.log('hcf', JSON.stringify(await ingestHcf(db, dest)));
    return;
  }
  console.error('Usage: cli.js ingest helloao [--commentary <helloao-id>] [--book ROM ...] | ingest hcf | report  [--db path]');
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof BlockedError ? err.message : err);
  process.exit(err instanceof BlockedError ? 3 : 1);
});
