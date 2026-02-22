import { describe, it, expect, beforeEach } from 'vitest';
import { CommentaryRetriever } from '../services/commentaryRetriever.js';

describe('CommentaryRetriever - parseVerseReference', () => {
  let retriever;

  beforeEach(() => {
    retriever = new CommentaryRetriever();
  });

  // ─── ENGLISH FORMAT TESTS ────────────────────────────────────

  describe('English standard format: "Book Chapter:Verse"', () => {
    it('parses "John 3:16" correctly', () => {
      const result = retriever.parseVerseReference('John 3:16');
      expect(result.book).toBe('joh');
      expect(result.chapter).toBe(3);
      expect(result.startVerse).toBe(16);
      expect(result.endVerse).toBeNull();
    });

    it('parses "Matthew 5:1-12" (verse range)', () => {
      const result = retriever.parseVerseReference('Matthew 5:1-12');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(5);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(12);
    });

    it('parses "Romans 8:28-39"', () => {
      const result = retriever.parseVerseReference('Romans 8:28-39');
      expect(result.book).toBe('rom');
      expect(result.chapter).toBe(8);
      expect(result.startVerse).toBe(28);
      expect(result.endVerse).toBe(39);
    });

    it('parses "Genesis 1:1"', () => {
      const result = retriever.parseVerseReference('Genesis 1:1');
      expect(result.book).toBe('gen');
      expect(result.chapter).toBe(1);
      expect(result.startVerse).toBe(1);
    });

    it('parses "Revelation 22:20-21"', () => {
      const result = retriever.parseVerseReference('Revelation 22:20-21');
      expect(result.book).toBe('rev');
      expect(result.chapter).toBe(22);
      expect(result.startVerse).toBe(20);
      expect(result.endVerse).toBe(21);
    });

    it('parses "Psalm 23:1-6"', () => {
      const result = retriever.parseVerseReference('Psalm 23:1-6');
      expect(result.book).toBe('psa');
      expect(result.chapter).toBe(23);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(6);
    });
  });

  describe('English abbreviated format', () => {
    it('parses "Gen 1:1"', () => {
      const result = retriever.parseVerseReference('Gen 1:1');
      expect(result.book).toBe('gen');
      expect(result.chapter).toBe(1);
      expect(result.startVerse).toBe(1);
    });

    it('parses "Matt 5:1-12"', () => {
      const result = retriever.parseVerseReference('Matt 5:1-12');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(5);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(12);
    });

    it('parses "Jn 3:16"', () => {
      const result = retriever.parseVerseReference('Jn 3:16');
      expect(result.book).toBe('joh');
    });

    it('parses "Rom 8:28"', () => {
      const result = retriever.parseVerseReference('Rom 8:28');
      expect(result.book).toBe('rom');
      expect(result.chapter).toBe(8);
      expect(result.startVerse).toBe(28);
    });

    it('parses "Rev 21:1-4"', () => {
      const result = retriever.parseVerseReference('Rev 21:1-4');
      expect(result.book).toBe('rev');
      expect(result.chapter).toBe(21);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(4);
    });
  });

  describe('English numbered books', () => {
    it('parses "1 Corinthians 13:1-13"', () => {
      const result = retriever.parseVerseReference('1 Corinthians 13:1-13');
      expect(result.book).toBe('1co');
      expect(result.chapter).toBe(13);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(13);
    });

    it('parses "2 Timothy 3:16-17"', () => {
      const result = retriever.parseVerseReference('2 Timothy 3:16-17');
      expect(result.book).toBe('2ti');
      expect(result.chapter).toBe(3);
      expect(result.startVerse).toBe(16);
      expect(result.endVerse).toBe(17);
    });

    it('parses "1 John 4:7-12"', () => {
      const result = retriever.parseVerseReference('1 John 4:7-12');
      expect(result.book).toBe('1jo');
      expect(result.chapter).toBe(4);
      expect(result.startVerse).toBe(7);
      expect(result.endVerse).toBe(12);
    });

    it('parses "1 Peter 2:9-10"', () => {
      const result = retriever.parseVerseReference('1 Peter 2:9-10');
      expect(result.book).toBe('1pe');
      expect(result.chapter).toBe(2);
      expect(result.startVerse).toBe(9);
      expect(result.endVerse).toBe(10);
    });
  });

  // ─── CHINESE FORMAT TESTS ────────────────────────────────────

  describe('Chinese format with space: "书 章:节"', () => {
    it('parses "太 5:1-12"', () => {
      const result = retriever.parseVerseReference('太 5:1-12');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(5);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(12);
    });

    it('parses "约 3:16"', () => {
      const result = retriever.parseVerseReference('约 3:16');
      expect(result.book).toBe('joh');
      expect(result.chapter).toBe(3);
      expect(result.startVerse).toBe(16);
    });

    it('parses "创世记 1:1-5"', () => {
      const result = retriever.parseVerseReference('创世记 1:1-5');
      expect(result.book).toBe('gen');
      expect(result.chapter).toBe(1);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(5);
    });

    it('parses "哥前 7:24-40"', () => {
      const result = retriever.parseVerseReference('哥前 7:24-40');
      expect(result.book).toBe('1co');
      expect(result.chapter).toBe(7);
      expect(result.startVerse).toBe(24);
      expect(result.endVerse).toBe(40);
    });

    it('parses "马太福音 5:1-12"', () => {
      const result = retriever.parseVerseReference('马太福音 5:1-12');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(5);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(12);
    });
  });

  describe('Chinese format without space: "书章:节"', () => {
    it('parses "太5:1-12"', () => {
      const result = retriever.parseVerseReference('太5:1-12');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(5);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(12);
    });

    it('parses "约3:16"', () => {
      const result = retriever.parseVerseReference('约3:16');
      expect(result.book).toBe('joh');
      expect(result.chapter).toBe(3);
      expect(result.startVerse).toBe(16);
    });

    it('parses "罗8:28-39"', () => {
      const result = retriever.parseVerseReference('罗8:28-39');
      expect(result.book).toBe('rom');
      expect(result.chapter).toBe(8);
      expect(result.startVerse).toBe(28);
      expect(result.endVerse).toBe(39);
    });
  });

  describe('Chinese format with colon prefix: "书:章:节"', () => {
    it('parses "太:10:4-8"', () => {
      const result = retriever.parseVerseReference('太:10:4-8');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(10);
      expect(result.startVerse).toBe(4);
      expect(result.endVerse).toBe(8);
    });

    it('parses "约:3:16"', () => {
      const result = retriever.parseVerseReference('约:3:16');
      expect(result.book).toBe('joh');
      expect(result.chapter).toBe(3);
      expect(result.startVerse).toBe(16);
    });
  });

  describe('Chinese wide-colon (：) normalization', () => {
    it('parses "太：5：1-12" with wide colons', () => {
      const result = retriever.parseVerseReference('太：5：1-12');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(5);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(12);
    });

    it('parses "太：10：4-8" with wide colons', () => {
      const result = retriever.parseVerseReference('太：10：4-8');
      expect(result.book).toBe('mat');
      expect(result.chapter).toBe(10);
      expect(result.startVerse).toBe(4);
      expect(result.endVerse).toBe(8);
    });
  });

  // ─── VALIDATION ERROR TESTS ──────────────────────────────────

  describe('validation errors (English)', () => {
    it('throws on book-only input "Genesis"', () => {
      expect(() => retriever.parseVerseReference('Genesis 1', 'en')).toThrow();
    });

    it('throws on invalid book name', () => {
      expect(() => retriever.parseVerseReference('Hezekiah 1:1', 'en')).toThrow(/Unknown book|Invalid verse format/);
    });

    it('throws on invalid chapter number (Genesis has 50 chapters)', () => {
      expect(() => retriever.parseVerseReference('Genesis 51:1', 'en')).toThrow(/Invalid chapter/);
    });

    it('throws on invalid start verse number', () => {
      expect(() => retriever.parseVerseReference('Genesis 1:32', 'en')).toThrow(/Invalid start verse/);
    });

    it('throws on invalid end verse number', () => {
      expect(() => retriever.parseVerseReference('Genesis 1:1-32', 'en')).toThrow(/Invalid end verse/);
    });

    it('throws when start verse > end verse', () => {
      expect(() => retriever.parseVerseReference('John 3:20-16', 'en')).toThrow(/Invalid verse range/);
    });

    it('throws on completely invalid format', () => {
      expect(() => retriever.parseVerseReference('hello world', 'en')).toThrow();
    });
  });

  describe('validation errors (Chinese)', () => {
    it('throws on invalid book name (Chinese)', () => {
      expect(() => retriever.parseVerseReference('哈哈 1:1', 'zh')).toThrow();
    });

    it('throws on invalid chapter (Chinese error message)', () => {
      expect(() => retriever.parseVerseReference('创世记 51:1', 'zh')).toThrow(/无效的章节号/);
    });

    it('throws on invalid verse (Chinese error message)', () => {
      expect(() => retriever.parseVerseReference('创世记 1:32', 'zh')).toThrow(/无效的起始节数/);
    });

    it('throws on verse range error (Chinese message)', () => {
      expect(() => retriever.parseVerseReference('约 3:20-16', 'zh')).toThrow(/无效的经文范围/);
    });
  });

  // ─── EDGE CASES ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('parses single verse (no range)', () => {
      const result = retriever.parseVerseReference('John 3:16');
      expect(result.startVerse).toBe(16);
      expect(result.endVerse).toBeNull();
    });

    it('parses verse range where start equals end conceptually', () => {
      const result = retriever.parseVerseReference('John 3:16-16');
      expect(result.startVerse).toBe(16);
      expect(result.endVerse).toBe(16);
    });

    it('handles first verse of first chapter of first book', () => {
      const result = retriever.parseVerseReference('Genesis 1:1');
      expect(result.book).toBe('gen');
      expect(result.chapter).toBe(1);
      expect(result.startVerse).toBe(1);
    });

    it('handles last verse of last chapter of last book', () => {
      const result = retriever.parseVerseReference('Revelation 22:21');
      expect(result.book).toBe('rev');
      expect(result.chapter).toBe(22);
      expect(result.startVerse).toBe(21);
    });

    it('handles Psalm 119 (longest chapter, 176 verses)', () => {
      const result = retriever.parseVerseReference('Psalm 119:1-176');
      expect(result.book).toBe('psa');
      expect(result.chapter).toBe(119);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(176);
    });

    it('handles Jude (single chapter book)', () => {
      const result = retriever.parseVerseReference('Jude 1:1-4');
      expect(result.book).toBe('jud');
      expect(result.chapter).toBe(1);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(4);
    });

    it('handles "1 Corinthians 16: 1-15" with space after colon', () => {
      const result = retriever.parseVerseReference('1 Corinthians 16: 1-15');
      expect(result.book).toBe('1co');
      expect(result.chapter).toBe(16);
      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(15);
    });
  });
});

describe('CommentaryRetriever - filterCommentaryByVerses', () => {
  let retriever;

  beforeEach(() => {
    retriever = new CommentaryRetriever();
  });

  it('returns full text when no startVerse provided', () => {
    const text = 'Some commentary text here';
    expect(retriever.filterCommentaryByVerses(text, null)).toBe(text);
  });

  it('extracts matching verse section', () => {
    const text = `Verse 1
Commentary on verse 1 goes here with details.

Verse 2
Commentary on verse 2 goes here with details.

Verse 3
Commentary on verse 3 goes here with details.`;
    
    const result = retriever.filterCommentaryByVerses(text, 2, 2);
    expect(result).toContain('Verse 2');
    expect(result).toContain('Commentary on verse 2');
  });

  it('extracts range of verse sections', () => {
    const text = `Verse 1
Commentary on verse 1.

Verse 2
Commentary on verse 2.

Verse 3
Commentary on verse 3.

Verse 4
Commentary on verse 4.`;
    
    const result = retriever.filterCommentaryByVerses(text, 2, 3);
    expect(result).toContain('Verse 2');
    expect(result).toContain('Verse 3');
  });

  it('handles "Verses X-Y" header format', () => {
    const text = `Verses 1-5
Commentary on verses 1 through 5.

Verses 6-10
Commentary on verses 6 through 10.

Verses 11-15
Commentary on verses 11 through 15.`;
    
    const result = retriever.filterCommentaryByVerses(text, 7, 9);
    expect(result).toContain('Verses 6-10');
    expect(result).toContain('Commentary on verses 6 through 10');
  });

  it('returns fallback message when no verse sections match', () => {
    const text = `Verse 1
Commentary on verse 1.

Verse 2
Commentary on verse 2.`;
    
    const result = retriever.filterCommentaryByVerses(text, 10, 12);
    expect(result).toContain('No commentary available for verses 10-12');
  });

  it('handles text with no verse headers', () => {
    const longText = 'A'.repeat(200); // General commentary with no verse headers
    const result = retriever.filterCommentaryByVerses(longText, 1, 5);
    expect(result).toContain('General commentary');
  });
});

describe('CommentaryRetriever - getCommentariesForDenomination', () => {
  let retriever;

  beforeEach(() => {
    retriever = new CommentaryRetriever();
  });

  it('returns verse count error when exceeding MAX_VERSES', async () => {
    const result = await retriever.getCommentariesForDenomination(
      'calvinism', 'Psalm 119:1-176', 3, 'en', null, 15
    );
    expect(result.error).toBeDefined();
    expect(result.error).toContain('176 verses');
    expect(result.error).toContain('exceeds the maximum');
  });

  it('returns verse count error in Chinese when language is zh', async () => {
    const result = await retriever.getCommentariesForDenomination(
      'calvinism', '诗 119:1-176', 3, 'zh', null, 15
    );
    expect(result.error).toBeDefined();
    expect(result.error).toContain('超过了最大限制');
  });

  it('throws on unknown denomination', async () => {
    await expect(
      retriever.getCommentariesForDenomination('buddhism', 'John 3:16')
    ).rejects.toThrow(/Unknown denomination/);
  });
});

describe('CommentaryRetriever - error messages', () => {
  let retriever;

  beforeEach(() => {
    retriever = new CommentaryRetriever();
  });

  it('generates English error messages', () => {
    const msg = retriever.getErrorMessage('unknownBook', { bookName: 'Foo' }, 'en');
    expect(msg).toContain('Unknown book');
    expect(msg).toContain('Foo');
  });

  it('generates Chinese error messages', () => {
    const msg = retriever.getErrorMessage('unknownBook', { bookName: '未知' }, 'zh');
    expect(msg).toContain('未知的书卷');
    expect(msg).toContain('未知');
  });

  it('falls back to English for unsupported languages', () => {
    const msg = retriever.getErrorMessage('unknownBook', { bookName: 'Foo' }, 'fr');
    expect(msg).toContain('Unknown book'); // Falls back to English
  });
});

describe('CommentaryRetriever - cache', () => {
  let retriever;

  beforeEach(() => {
    retriever = new CommentaryRetriever();
  });

  it('starts with empty cache', () => {
    expect(retriever.cache.size).toBe(0);
  });

  it('clearCache empties the cache', () => {
    retriever.cache.set('test-key', 'test-value');
    expect(retriever.cache.size).toBe(1);
    retriever.clearCache();
    expect(retriever.cache.size).toBe(0);
  });
});
