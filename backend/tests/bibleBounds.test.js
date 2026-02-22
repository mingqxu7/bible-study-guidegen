import { describe, it, expect } from 'vitest';
import { getBookBounds, isValidChapter, isValidVerse, getMaxVerse, bibleBounds } from '../services/bibleBounds.js';

describe('bibleBounds', () => {
  describe('getBookBounds', () => {
    it('returns bounds for a valid OT book', () => {
      const bounds = getBookBounds('gen');
      expect(bounds).toBeDefined();
      expect(bounds.chapters).toBe(50);
      expect(bounds.verses[1]).toBe(31); // Genesis 1 has 31 verses
    });

    it('returns bounds for a valid NT book', () => {
      const bounds = getBookBounds('mat');
      expect(bounds).toBeDefined();
      expect(bounds.chapters).toBe(28);
    });

    it('returns null/undefined for an invalid book', () => {
      expect(getBookBounds('xyz')).toBeFalsy();
      expect(getBookBounds('')).toBeFalsy();
    });

    it('has all 66 books of the Bible', () => {
      const bookCodes = Object.keys(bibleBounds);
      expect(bookCodes.length).toBe(66);
    });

    it('Psalms has 150 chapters', () => {
      const bounds = getBookBounds('psa');
      expect(bounds.chapters).toBe(150);
    });

    it('Jude has 1 chapter', () => {
      const bounds = getBookBounds('jud');
      expect(bounds).toBeDefined();
      expect(bounds.chapters).toBe(1);
    });

    it('Revelation has 22 chapters', () => {
      const bounds = getBookBounds('rev');
      expect(bounds.chapters).toBe(22);
    });
  });

  describe('isValidChapter', () => {
    it('returns true for valid chapter numbers', () => {
      expect(isValidChapter('gen', 1)).toBe(true);
      expect(isValidChapter('gen', 50)).toBe(true);
      expect(isValidChapter('mat', 28)).toBe(true);
    });

    it('returns false for chapter 0', () => {
      expect(isValidChapter('gen', 0)).toBe(false);
    });

    it('returns false for chapter exceeding max', () => {
      expect(isValidChapter('gen', 51)).toBe(false);
      expect(isValidChapter('mat', 29)).toBe(false);
    });

    it('returns false for negative chapter', () => {
      expect(isValidChapter('gen', -1)).toBe(false);
    });

    it('returns false for invalid book', () => {
      expect(isValidChapter('xyz', 1)).toBe(false);
    });
  });

  describe('isValidVerse', () => {
    it('returns true for valid verse numbers', () => {
      expect(isValidVerse('gen', 1, 1)).toBe(true);
      expect(isValidVerse('gen', 1, 31)).toBe(true); // Genesis 1 has 31 verses
    });

    it('returns false for verse 0', () => {
      expect(isValidVerse('gen', 1, 0)).toBe(false);
    });

    it('returns false for verse exceeding max', () => {
      expect(isValidVerse('gen', 1, 32)).toBe(false); // Genesis 1 only has 31
    });

    it('returns false for invalid chapter', () => {
      expect(isValidVerse('gen', 51, 1)).toBe(false);
    });

    it('handles single-chapter books correctly', () => {
      // Jude has 1 chapter with 25 verses
      expect(isValidVerse('jud', 1, 25)).toBe(true);
      expect(isValidVerse('jud', 1, 26)).toBe(false);
    });
  });

  describe('getMaxVerse', () => {
    it('returns correct max verse for known chapters', () => {
      expect(getMaxVerse('gen', 1)).toBe(31);
      expect(getMaxVerse('gen', 2)).toBe(25);
      expect(getMaxVerse('joh', 3)).toBe(36); // John 3 has 36 verses (including John 3:16!)
    });

    it('returns 0 or undefined for invalid chapter', () => {
      const result = getMaxVerse('gen', 51);
      expect(result === 0 || result === undefined).toBe(true);
    });

    it('returns 0 or undefined for invalid book', () => {
      const result = getMaxVerse('xyz', 1);
      expect(result === 0 || result === undefined).toBe(true);
    });
  });

  describe('data integrity', () => {
    it('every book has consistent chapters count and verses object', () => {
      for (const [book, data] of Object.entries(bibleBounds)) {
        const verseKeys = Object.keys(data.verses).map(Number);
        expect(verseKeys.length).toBe(data.chapters);
        
        // Chapters should be sequential 1..N
        for (let i = 1; i <= data.chapters; i++) {
          expect(data.verses[i]).toBeGreaterThan(0);
        }
      }
    });

    it('Psalm 119 has 176 verses (longest chapter)', () => {
      expect(bibleBounds.psa.verses[119]).toBe(176);
    });

    it('Psalm 117 has 2 verses (shortest chapter)', () => {
      expect(bibleBounds.psa.verses[117]).toBe(2);
    });

    it('John 11:35 is a valid verse (shortest verse in English)', () => {
      expect(isValidVerse('joh', 11, 35)).toBe(true);
    });
  });
});
