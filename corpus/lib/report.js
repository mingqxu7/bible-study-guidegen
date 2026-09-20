import { bibleBounds } from '../../backend/services/bibleBounds.js';

export function coverage(db) {
  const ids = db.prepare('SELECT commentary_id FROM sources ORDER BY commentary_id').all().map((r) => r.commentary_id);
  const out = {};
  for (const id of ids) {
    const have = new Map(
      db.prepare('SELECT book, COUNT(DISTINCT chapter) AS n FROM passages WHERE commentary_id = ? GROUP BY book')
        .all(id).map((r) => [r.book, r.n]),
    );
    let chaptersHave = 0;
    let chaptersTotal = 0;
    const missingBooks = [];
    const partialBooks = [];
    for (const [code, b] of Object.entries(bibleBounds)) {
      const n = Math.min(have.get(code) ?? 0, b.chapters);
      chaptersTotal += b.chapters;
      chaptersHave += n;
      if (n === 0) missingBooks.push(code);
      else if (n < b.chapters) partialBooks.push({ book: code, have: n, total: b.chapters });
    }
    out[id] = { chaptersHave, chaptersTotal, missingBooks, partialBooks };
  }
  return out;
}

export function formatReport(db) {
  const lines = ['Coverage'];
  for (const [id, c] of Object.entries(coverage(db))) {
    lines.push(`${id}: ${c.chaptersHave}/${c.chaptersTotal} chapters; ${c.missingBooks.length} books missing, ${c.partialBooks.length} partial`);
    if (c.missingBooks.length) lines.push(`  missing: ${c.missingBooks.join(' ')}`);
    if (c.partialBooks.length) lines.push(`  partial: ${c.partialBooks.map((p) => `${p.book} ${p.have}/${p.total}`).join(', ')}`);
  }
  lines.push('', 'Sources and licenses');
  for (const s of db.prepare('SELECT commentary_id, source, license FROM sources ORDER BY commentary_id').all()) {
    lines.push(`${s.commentary_id}  [${s.source}]  ${s.license}`);
  }
  return lines.join('\n');
}
