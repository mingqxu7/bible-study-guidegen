# Commentary Research Corpus: Ingestion Pipeline Design

Date: 2026-09-20
Status: Draft for review

## Goal

Build a local, queryable research corpus of public-domain Bible commentaries
from sources that officially support bulk use. Output is a single sqlite file.

## Non-goals

- No StudyLight.org access. It serves a Cloudflare Managed Challenge to
  automated clients; we do not circumvent it, and this pipeline never contacts it.
- No traffic disguise (randomized "study-like" access patterns, spoofed browser
  identity). All requests use an honest, identified User-Agent.
- No copyrighted commentaries (Scofield, Ironside, McGee, Constable, Orchard).
  Out of scope until a licensed source exists.
- Phase 1 does not cover Benson, Whedon, Darby's Synopsis, Kretzmann, Bengel,
  Haydock (no verified bulk source yet). Tracked as a separate probe.
- No changes to the existing app (`backend/`, `frontend/`). Corpus is standalone.

## Sources (Phase 1)

| Source | Commentaries | Access |
|---|---|---|
| HelloAO API (`bible.helloao.org/api`) | Calvin, Matthew Henry, Gill, JFB, Clarke | Static JSON, no documented limits, PD mark |
| HistoricalChristianFaith Commentaries-Database (GitHub release, sqlite) | Lapide, Wesley, Calvin, Luther | Single release download; read LICENSE before use |
| CrossWire SWORD module ZIPs | Barnes (NT only), Wesley/Luther as fallback | Module ZIP download only; robots.txt Crawl-delay 30 |

Known gaps in these sources: HelloAO Henry is section-level; HelloAO Clarke has
57 books; SWORD Barnes is NT-only; SWORD Luther is selected passages.
Gaps are recorded in the coverage report, not papered over.

## Layout

New standalone package at repo root: `corpus/` (own `package.json`, so the app
backend gains no new dependencies).

```
corpus/
  package.json
  sources/
    helloao.js      # fetch + parse -> normalized rows
    hcf.js          # download release sqlite, map -> normalized rows
    sword.js        # parse module ZIP -> normalized rows (Barnes first)
  lib/
    fetcher.js      # shared polite HTTP: identified UA, per-host limiter, retry/backoff
    db.js           # sqlite schema + upsert
    licenses.js     # per-source license/attribution records
  cli.js            # `ingest <source>`, `report`
  cache/            # raw downloads (gitignored)
  corpus.sqlite     # output (gitignored)
```

## Data model

Table `passages`:
`commentary_id, source, book, chapter, verse_start, verse_end, text, license, fetched_at`
Unique key: `(commentary_id, book, chapter, verse_start, verse_end)`.
Books use the existing 3-letter codes from `backend/services/commentaryMapping.js`
(`bookMapping`) so the corpus lines up with the app.

Table `sources`: `commentary_id, name, author, source, source_url, license, attribution, notes`.

Section-level commentaries (Henry) keep their real verse ranges; no
splitting into fake per-verse rows.

## Fetching rules (`lib/fetcher.js`)

- User-Agent: `bible-commentary-corpus/0.1 (research; contact: <configured email>)`.
- One limiter per host, shared by all workers. Defaults: HelloAO 2 concurrent
  and roughly 5 req/s max; CrossWire 1 request per 30s; GitHub single download.
- Retry with exponential backoff on 429/5xx; abort the source on repeated 403
  (treat as "blocked, stop", never work around it).
- Raw responses cached to `cache/`; reruns skip anything already downloaded
  (resumable, idempotent).
- Bulk-friendly sources (HelloAO static JSON, release downloads) use a small
  worker pool; the limiter, not the pool size, sets the load on the server.

## CLI

- `node cli.js ingest helloao|hcf|sword [--commentary <id>]`
- `node cli.js report`: per commentary, book/chapter coverage, gaps vs the
  Bible bounds in `backend/services/bibleBounds.js`, and license/attribution list.

## Licensing

Each row carries its license. Before ingesting a source, `licenses.js` records
the license text or PD mark found (HCF LICENSE and SWORD `.conf` files are read
during implementation, not assumed). A source whose terms disallow local
copying is skipped and reported.

## Testing

- Unit tests for each parser against small fixture files (a few verses each).
- Fetcher tests with a mock server: limiter spacing, backoff, stop-on-403.
- Idempotency test: ingest twice, row count unchanged.
- `report` verified against a fixture DB with a known gap.

## Decisions made during planning

1. sqlite driver: Node built-in `node:sqlite` (Node >= 22.13), so the package has no dependencies.
2. SWORD ingestion is deferred to a follow-up plan (Barnes, NT only, depends on it).
   The first plan covers HelloAO + HCF.
3. Contact address for the User-Agent comes from the `CORPUS_CONTACT` env var.
4. `passages` also stores `end_chapter` (HCF ranges can cross chapters) and `seq`
   (one HCF file can hold several excerpts for the same range); both are part of the unique key.
5. HCF ingestion uses an author allowlist (Lapide, Wesley, Luther) because HCF's LICENSE
   says the database also contains copyrighted fair-use excerpts.

## Still open

- Phase 2 probe: Benson, Whedon, Darby, Kretzmann, Bengel, Haydock.
- SWORD ingestion plan (Barnes, and cross-checks for Wesley/Luther/Clarke/Calvin).
