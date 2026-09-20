# On-Demand Chinese Translation of Corpus Commentaries: Design

Date: 2026-09-20
Status: Draft for review
Extends: `2026-09-20-commentary-corpus-design.md` (adds a translation layer to the `corpus/` package)

## Goal

Let the user translate a passage's commentary into Simplified Chinese on demand from the corpus
command line, store the result permanently in `corpus.sqlite`, and read it back later at no
cost. The English `passages` table is never modified. The storage is shaped so a future app
feature can reuse it (decided: "CLI now, app later").

## Non-goals

- No bulk or batch translation (a separate, later decision; the sample study put a full-corpus
  Sonnet run at roughly $1,000 or more at list price, unverified).
- No change to `backend/` or `frontend/`; the app does not read this table yet.
- No Traditional Chinese (the `lang` column leaves room for it).
- No automatic translation: nothing is sent to the API unless the user runs `translate`.

## Evidence from the sample study (2026-09-20)

48 passages (6 per commentary; short, medium and long) were translated by Haiku 4.5 and by Sonnet
with the same prompt, then compared.

- Both translated every passage completely. Chinese length was 20-31% of English length in every
  length bucket for both models (no truncation or summarizing). No Traditional characters.
- Original-language words were preserved by both (Clarke on 2 Sam 14:30: all 230 Greek and 43
  Hebrew characters kept).
- **Sonnet is clearly better.** Haiku mixed 神 (143 uses) and 上帝 (164) for "God" and made
  real errors (试探账户 for "account of the temptation"; 祖先 for "first parents"; English book
  names left untranslated twice). Sonnet was consistent, idiomatic, and used 始祖, 拣选, 耶和华
  correctly.
- Consequences for this design: default model is Sonnet; the prompt fixes one rendering of "God"
  (decided: **上帝**, the 和合本上帝版 convention); a length-ratio sanity check is cheap and
  effective.

## Storage

Added to the schema in `corpus/lib/db.js` with `CREATE TABLE IF NOT EXISTS` (existing databases
gain it on next open; `passages` is untouched):

```sql
CREATE TABLE IF NOT EXISTS translations (
  commentary_id  TEXT NOT NULL,
  book           TEXT NOT NULL,
  chapter        INTEGER NOT NULL,
  verse_start    INTEGER NOT NULL,
  end_chapter    INTEGER NOT NULL,
  verse_end      INTEGER NOT NULL,
  seq            INTEGER NOT NULL DEFAULT 0,
  lang           TEXT NOT NULL,          -- 'zh-Hans'
  model          TEXT NOT NULL,          -- e.g. 'claude-sonnet-5'
  prompt_version TEXT NOT NULL,          -- e.g. 'zh-hans-v2'
  text           TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL,
  output_tokens  INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (commentary_id, book, chapter, verse_start, end_chapter, verse_end, seq,
               lang, model, prompt_version)
);
CREATE INDEX IF NOT EXISTS idx_translations_book_chapter ON translations (book, chapter);
```

The first seven columns are the `passages` key, so a future reader joins the two tables on them.
The key includes `model` and `prompt_version`: changing either creates a new row instead of
overwriting, so versions can be compared. Token counts are summed over a passage's chunks.

New `db.js` helpers: `getTranslation(db, key, {lang, model, promptVersion}) -> row | null` and
`saveTranslation(db, row)` (a single-row upsert in its own transaction; not nested).

## API client (`corpus/lib/anthropic.js`)

`createClient({ apiKey, model, fetchImpl = fetch, sleep, now, maxRetries = 4, baseBackoffMs = 1000 })`
returns `{ complete({ system, user, maxTokens }) -> { text, inputTokens, outputTokens, stopReason } }`.

- Endpoint `https://api.anthropic.com/v1/messages`, headers `x-api-key`,
  `anthropic-version: 2023-06-01`, `content-type: application/json`; body `{ model, max_tokens,
  system, messages: [{ role: 'user', content: user }] }`. No SDK, no dependency.
- The key comes only from the `ANTHROPIC_API_KEY` environment variable (read in `cli.js`); a
  missing key is a clear error and exit code 2. The key is never logged or written to disk.
- Retry with exponential backoff on 429, 5xx and 529, honoring `retry-after` (seconds). 401 and
  403 throw `AuthError` immediately (never retried); other 4xx throw `ApiError` with the API's
  error message.
- The response text is the concatenation of `content` blocks of type `text`.

## Translator (`corpus/lib/translate.js`)

**Prompt** (`PROMPT_VERSION = 'zh-hans-v2'`, a constant in the module; v2 added the 和合本 pronoun rule: 他 for God, Christ, the Spirit and the devil, never 祂, and 它 only for animals and things): a system prompt telling the
model to translate historic English Bible-commentary text into Simplified Chinese in a formal,
reverent register and to output only the translation. Rules (from the sample study):
use 和合本上帝版 terms (上帝, 耶和华, 耶稣基督, 圣灵, 称义, 救赎 ...); standard Chinese book
names with chapter:verse numerals unchanged; keep Hebrew, Greek and Latin words as written (add a
Chinese gloss in parentheses only where the author glosses them); render archaic abbreviations
such as "&c." as 等等; translate everything, never summarize, shorten, reorder or add notes;
preserve paragraph breaks and numbering. The user message carries the commentary name, the passage
reference, "part i of n" when chunked, and the text.

**Chunking** (`chunkText(text, limit = 6000) -> {text, sep}[]`): split at blank-line paragraph
boundaries and pack greedily up to `limit` characters. A single paragraph longer than `limit` is
split at sentence boundaries (`. `, `? `, `! `, `; `), and as a last resort hard-split at `limit`.
Each chunk records the separator that originally followed it (`"\n\n"` between paragraphs, `" "`
inside a paragraph); stitching rejoins chunk translations with those separators, so a
sentence-level split never invents a paragraph break.

**Per-chunk call**: `maxTokens = 16000`. If `stopReason === 'max_tokens'` or the reply is empty the
passage fails (a truncated translation is never stored).

**Sanity check** (per whole passage, skipped when the English is under 200 characters): the count of
CJK characters divided by the English character count must be between 0.10 and 0.60 (observed
0.20-0.31); otherwise the passage fails with a message naming the ratio (this catches refusals,
summaries and truncation).

**`translatePassage(db, client, passage, {model, force})`**:
1. If `!force` and `getTranslation` finds a row for `(lang 'zh-Hans', model, PROMPT_VERSION)`, return
   `{ status: 'cached' }` without calling the API.
2. Otherwise chunk, translate each chunk in order (sequential), check, stitch, and only then
   `saveTranslation` (one row per passage, tokens summed). Returns
   `{ status: 'translated', inputTokens, outputTokens }`.
3. Any failure returns `{ status: 'failed', error }` and writes nothing for that passage.

**Passage selection** (`selectPassages(db, commentaryId, book, chapter, verse?)`):
- chapter only: every passage with `chapter = <chapter>` (passages starting in that chapter).
- `chapter:verse`: every passage whose range covers that verse, i.e.
  `(chapter < c OR (chapter = c AND verse_start <= v)) AND (end_chapter > c OR (end_chapter = c AND verse_end >= v))`.
- Ordered by `verse_start, seq`. An unknown commentary id or book code is a usage error (exit 1).

## CLI (`corpus/cli.js`)

- `translate <commentary> <book> <chapter>[:<verse>] [--model <id>] [--force] [--dry-run] [--max-chars <n>]`
  - `<commentary>` is a `commentary_id` (`gill`, `wesley`, ...), `<book>` a repo 3-letter code
    (`rom`, `gen`, `1co`), default model `claude-sonnet-5`.
  - Passages already translated (same model and prompt version, unless `--force`) are counted as
    cached and skipped.
  - Guard: the total characters of the passages that would be translated must be at most
    `--max-chars` (default 30000), otherwise the command refuses before any API call and prints how
    many characters were requested and how to raise the limit. This prevents accidental spend
    (a single Luther preface can exceed 60,000 characters).
  - `--dry-run` prints: passages matched, already cached, to translate, total characters, chunk
    count, and rough token estimates (input about characters/4 plus about 500 per chunk of prompt;
    output about characters x 0.4), labelled "estimate". It makes no API call and needs no key.
  - Prints one line per passage (`translated` / `cached` / `failed: <reason>`) and a summary with
    token totals. Exit 0 if none failed, 1 if any failed, 2 for a missing API key, 3 for an
    `AuthError` (401/403), which also stops the run.
- `show <commentary> <book> <chapter>[:<verse>] [--model <id>]`: for each matching passage print
  the reference, the English text, and the stored Chinese text if any (labelled
  `机器翻译 / machine translation, <model>, <prompt_version>`), or `(no translation yet)`. No API call.
- `translations report`: per commentary, the number of translated passages of the total, and the
  sum of input and output tokens, grouped by model and prompt version. No prices are hard-coded.
- The usage string lists the new commands.

## Privacy and honesty

`translate` sends the English commentary text of the selected passages to the Anthropic API; nothing
else is sent. Stored and displayed translations are always labelled as machine translation with the
model and prompt version. The English source is public domain (see the corpus spec); the
translations are new machine output and carry no third-party copyright.

## Error handling summary

Missing key (exit 2); auth failure (exit 3, run stops); truncation, empty reply or bad length ratio
(passage failed, nothing stored, run continues); network or 5xx (retried, then the passage fails);
over-limit request (refused before any call).

## Testing

- `anthropic.test.js`: fake `fetchImpl` and fake clock: request shape (URL, headers, body),
  success returns text and token usage, 429 with `retry-after`, 5xx backoff then success, retries
  exhausted, 401 and 403 throw `AuthError` without retry, other 4xx throw `ApiError` with the
  message, missing key rejected.
- `translate.test.js`: `chunkText` (paragraph packing, oversize paragraph at sentence boundaries,
  hard split, separators preserved on stitching); `translatePassage` with a fake client (cache hit
  makes no call, `force` calls again, chunked passage stitched in order with tokens summed,
  `max_tokens` stop reason fails and stores nothing, bad ratio fails and stores nothing, short text
  skips the ratio check); `selectPassages` (chapter, verse inside a range, verse in a cross-chapter
  range, none matching, ordering).
- `db.test.js` additions: `translations` table exists on a fresh and on an older database,
  `saveTranslation`/`getTranslation` round trip, a new `prompt_version` or `model` adds a row.
- Command-level tests through exported functions (`runTranslate`, `runShow`) with a fake client:
  dry-run makes no calls, the `--max-chars` refusal, per-passage output lines, exit codes.
- Live check (manual, the user's key): `translate wesley gen 3:1 --dry-run`, then the same without
  `--dry-run`, `show wesley gen 3:1`, then repeat `translate` and confirm it reports `cached` with
  no token use, and confirm the text uses 上帝.

## Open items

None blocking. Later, separately: an app-side reader for `translations`, Traditional output, and
batch translation once a scope is chosen.
