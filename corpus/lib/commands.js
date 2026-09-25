import { BOOKS } from './books.js';
import { getTranslation, setAccess } from './db.js';
import { LANG, PROMPT_VERSION, chunkText, formatRef, selectPassages, translatePassage } from './translate.js';

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseRef(ref) {
  const m = /^(\d+)(?::(\d+))?$/.exec(String(ref ?? ''));
  if (!m || Number(m[1]) < 1 || (m[2] !== undefined && Number(m[2]) < 1)) {
    throw new UsageError(`Bad reference "${ref}". Use <chapter> or <chapter>:<verse>, e.g. 8 or 8:28.`);
  }
  return { chapter: Number(m[1]), verse: m[2] === undefined ? null : Number(m[2]) };
}

function resolve(db, commentary, book, ref) {
  const { chapter, verse } = parseRef(ref);
  const source = db.prepare('SELECT name FROM sources WHERE commentary_id = ?').get(commentary);
  if (!source) {
    const known = db.prepare('SELECT commentary_id FROM sources ORDER BY commentary_id').all().map((r) => r.commentary_id);
    throw new UsageError(`Unknown commentary "${commentary}". Known: ${known.join(', ') || '(none ingested)'}`);
  }
  if (!BOOKS.some((b) => b.code === book)) {
    throw new UsageError(`Unknown book code "${book}". Use the 3-letter codes, e.g. rom, gen, 1co.`);
  }
  return { name: source.name, passages: selectPassages(db, commentary, book, chapter, verse) };
}

const label = (p) => formatRef(p) + (p.seq > 0 ? ` (entry ${p.seq + 1})` : '');

export async function runTranslate({
  db, client, model, commentary, book, ref, force = false, dryRun = false, maxChars = 30000, log = console.log,
}) {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new UsageError('--max-chars must be a positive integer');
  const { name, passages } = resolve(db, commentary, book, ref);
  if (!passages.length) {
    log(`No passages match ${commentary} ${book} ${ref}.`);
    return 0;
  }
  const where = { lang: LANG, model, promptVersion: PROMPT_VERSION };
  const isCached = (p) => !force && getTranslation(db, p, where) !== null;
  const todo = passages.filter((p) => !isCached(p));
  const chars = todo.reduce((n, p) => n + p.text.length, 0);

  if (dryRun) {
    const chunks = todo.reduce((n, p) => n + chunkText(p.text).length, 0);
    log(`Matched ${passages.length} passage(s): ${passages.length - todo.length} already translated, ${todo.length} to translate`);
    log(`Characters to translate: ${chars} (chunks: ${chunks})`);
    log(`Estimate (rough): ~${Math.round(chars / 4 + 500 * chunks)} input tokens, ~${Math.round(chars * 0.4)} output tokens`);
    log(chars <= maxChars
      ? `Limit check: ${chars} <= ${maxChars} (--max-chars)`
      : `Would be REFUSED: ${chars} characters exceeds --max-chars ${maxChars}`);
    return 0;
  }
  if (chars > maxChars) {
    throw new UsageError(
      `Refusing: ${chars} characters to translate exceeds --max-chars ${maxChars}. ` +
      `Narrow the reference, or pass --max-chars ${chars} to allow it.`,
    );
  }

  const tally = { translated: 0, cached: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
  for (const p of passages) {
    const r = await translatePassage(db, client, p, { commentaryName: name, force });
    if (r.status === 'translated') {
      tally.translated++;
      tally.inputTokens += r.inputTokens;
      tally.outputTokens += r.outputTokens;
      log(`${commentary} ${label(p)}: translated (in ${r.inputTokens} / out ${r.outputTokens} tokens)`);
    } else if (r.status === 'cached') {
      tally.cached++;
      log(`${commentary} ${label(p)}: cached`);
    } else {
      tally.failed++;
      log(`${commentary} ${label(p)}: failed: ${r.error}`);
    }
  }
  log(`Done: ${tally.translated} translated, ${tally.cached} cached, ${tally.failed} failed; tokens in ${tally.inputTokens} / out ${tally.outputTokens}`);
  return tally.failed > 0 ? 1 : 0;
}

export function runShow({ db, model, commentary, book, ref, log = console.log }) {
  const { passages } = resolve(db, commentary, book, ref);
  if (!passages.length) log(`No passages match ${commentary} ${book} ${ref}.`);
  for (const p of passages) {
    log(`== ${label(p)} [${commentary}] ==`);
    log(p.text);
    const t = getTranslation(db, p, { lang: LANG, model, promptVersion: PROMPT_VERSION });
    if (t) {
      log(`--- 机器翻译 / machine translation (${model}, ${PROMPT_VERSION}) ---`);
      log(t.text);
    } else {
      log('(no translation yet)');
    }
    log('');
  }
}

export function runTranslationsReport({ db, log = console.log }) {
  const rows = db.prepare(`
    SELECT commentary_id AS c, model, prompt_version AS pv, COUNT(*) AS n,
           SUM(input_tokens) AS tin, SUM(output_tokens) AS tout
    FROM translations GROUP BY commentary_id, model, prompt_version ORDER BY commentary_id, model, prompt_version`).all();
  if (!rows.length) {
    log('No translations yet.');
    return;
  }
  for (const r of rows) {
    const total = db.prepare('SELECT COUNT(*) AS n FROM passages WHERE commentary_id = ?').get(r.c).n;
    log(`${r.c}  ${r.model}  ${r.pv}  ${r.n} of ${total} passages  in ${r.tin} / out ${r.tout} tokens`);
  }
}

export function runAccess({ db, commentary, access, log = console.log }) {
  try {
    setAccess(db, commentary, access);
  } catch (err) {
    throw new UsageError(err.message);
  }
  log(`${commentary}: access set to ${access}`);
}
