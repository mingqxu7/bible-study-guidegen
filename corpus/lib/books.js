// [repo code (matches backend bibleBounds), USFM id used by HelloAO, English name used by HCF]
const ROWS = [
  ['gen', 'GEN', 'Genesis'], ['exo', 'EXO', 'Exodus'], ['lev', 'LEV', 'Leviticus'],
  ['num', 'NUM', 'Numbers'], ['deu', 'DEU', 'Deuteronomy'], ['jos', 'JOS', 'Joshua'],
  ['jdg', 'JDG', 'Judges'], ['rut', 'RUT', 'Ruth'], ['1sa', '1SA', '1 Samuel'],
  ['2sa', '2SA', '2 Samuel'], ['1ki', '1KI', '1 Kings'], ['2ki', '2KI', '2 Kings'],
  ['1ch', '1CH', '1 Chronicles'], ['2ch', '2CH', '2 Chronicles'], ['ezr', 'EZR', 'Ezra'],
  ['neh', 'NEH', 'Nehemiah'], ['est', 'EST', 'Esther'], ['job', 'JOB', 'Job'],
  ['psa', 'PSA', 'Psalms'], ['pro', 'PRO', 'Proverbs'], ['ecc', 'ECC', 'Ecclesiastes'],
  ['sng', 'SNG', 'Song of Solomon'], ['isa', 'ISA', 'Isaiah'], ['jer', 'JER', 'Jeremiah'],
  ['lam', 'LAM', 'Lamentations'], ['eze', 'EZK', 'Ezekiel'], ['dan', 'DAN', 'Daniel'],
  ['hos', 'HOS', 'Hosea'], ['joe', 'JOL', 'Joel'], ['amo', 'AMO', 'Amos'],
  ['oba', 'OBA', 'Obadiah'], ['jon', 'JON', 'Jonah'], ['mic', 'MIC', 'Micah'],
  ['nah', 'NAM', 'Nahum'], ['hab', 'HAB', 'Habakkuk'], ['zep', 'ZEP', 'Zephaniah'],
  ['hag', 'HAG', 'Haggai'], ['zec', 'ZEC', 'Zechariah'], ['mal', 'MAL', 'Malachi'],
  ['mat', 'MAT', 'Matthew'], ['mar', 'MRK', 'Mark'], ['luk', 'LUK', 'Luke'],
  ['joh', 'JHN', 'John'], ['act', 'ACT', 'Acts'], ['rom', 'ROM', 'Romans'],
  ['1co', '1CO', '1 Corinthians'], ['2co', '2CO', '2 Corinthians'], ['gal', 'GAL', 'Galatians'],
  ['eph', 'EPH', 'Ephesians'], ['phi', 'PHP', 'Philippians'], ['col', 'COL', 'Colossians'],
  ['1th', '1TH', '1 Thessalonians'], ['2th', '2TH', '2 Thessalonians'],
  ['1ti', '1TI', '1 Timothy'], ['2ti', '2TI', '2 Timothy'], ['tit', 'TIT', 'Titus'],
  ['phm', 'PHM', 'Philemon'], ['heb', 'HEB', 'Hebrews'], ['jam', 'JAS', 'James'],
  ['1pe', '1PE', '1 Peter'], ['2pe', '2PE', '2 Peter'], ['1jo', '1JN', '1 John'],
  ['2jo', '2JN', '2 John'], ['3jo', '3JN', '3 John'], ['jud', 'JUD', 'Jude'],
  ['rev', 'REV', 'Revelation'],
];

export const BOOKS = ROWS.map(([code, usfm, name]) => ({ code, usfm, name }));
export const USFM_TO_CODE = Object.fromEntries(BOOKS.map((b) => [b.usfm, b.code]));
// HCF stores book as the English name, lowercased, spaces removed ("1 Corinthians" -> "1corinthians").
export const HCF_NAME_TO_CODE = Object.fromEntries(
  BOOKS.map((b) => [b.name.toLowerCase().replace(/ /g, ''), b.code]),
);
