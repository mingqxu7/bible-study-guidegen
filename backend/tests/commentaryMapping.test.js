import { describe, it, expect } from 'vitest';
import { commentaryMapping, getCommentaryUrl, getStudyLightBookName, bookMapping } from '../services/commentaryMapping.js';

describe('commentaryMapping', () => {
  describe('denomination mappings', () => {
    const expectedDenominations = ['calvinism', 'arminianism', 'dispensationalism', 'lutheranism', 'catholicism'];

    it('has all expected denominations', () => {
      for (const denom of expectedDenominations) {
        expect(commentaryMapping[denom]).toBeDefined();
        expect(Array.isArray(commentaryMapping[denom])).toBe(true);
        expect(commentaryMapping[denom].length).toBeGreaterThan(0);
      }
    });

    it('every commentary has required fields', () => {
      for (const [denom, commentaries] of Object.entries(commentaryMapping)) {
        for (const commentary of commentaries) {
          expect(commentary.name).toBeDefined();
          expect(typeof commentary.name).toBe('string');
          expect(commentary.name.length).toBeGreaterThan(0);

          expect(commentary.code).toBeDefined();
          expect(typeof commentary.code).toBe('string');
          expect(commentary.code.length).toBeGreaterThan(0);

          expect(commentary.author).toBeDefined();
          expect(typeof commentary.author).toBe('string');
          expect(commentary.author.length).toBeGreaterThan(0);
        }
      }
    });

    it('all commentary codes are unique within each denomination', () => {
      for (const [denom, commentaries] of Object.entries(commentaryMapping)) {
        const codes = commentaries.map(c => c.code);
        const uniqueCodes = new Set(codes);
        expect(codes.length).toBe(uniqueCodes.size);
      }
    });

    it('calvinism includes Calvin and Matthew Henry', () => {
      const calvinism = commentaryMapping.calvinism;
      const names = calvinism.map(c => c.name);
      expect(names).toContain("Calvin's Commentary");
      expect(names).toContain("Matthew Henry");
    });

    it('dispensationalism includes Scofield and Darby', () => {
      const disp = commentaryMapping.dispensationalism;
      const names = disp.map(c => c.name);
      expect(names).toContain("Scofield Reference Notes");
      expect(names).toContain("Darby's Synopsis");
    });
  });

  describe('getStudyLightBookName', () => {
    it('maps OT book codes correctly', () => {
      expect(getStudyLightBookName('gen')).toBe('genesis');
      expect(getStudyLightBookName('exo')).toBe('exodus');
      expect(getStudyLightBookName('psa')).toBe('psalms');
      expect(getStudyLightBookName('isa')).toBe('isaiah');
    });

    it('maps NT book codes correctly', () => {
      expect(getStudyLightBookName('mat')).toBe('matthew');
      expect(getStudyLightBookName('joh')).toBe('john');
      expect(getStudyLightBookName('rom')).toBe('romans');
      expect(getStudyLightBookName('rev')).toBe('revelation');
    });

    it('handles numbered books', () => {
      expect(getStudyLightBookName('1co')).toBe('1-corinthians');
      expect(getStudyLightBookName('2co')).toBe('2-corinthians');
      expect(getStudyLightBookName('1sa')).toBe('1-samuel');
      expect(getStudyLightBookName('1th')).toBe('1-thessalonians');
    });
  });

  describe('getCommentaryUrl', () => {
    it('generates correct URL format', () => {
      const url = getCommentaryUrl('cal', 'joh', 3);
      expect(url).toBe('https://www.studylight.org/commentaries/eng/cal/john-3.html');
    });

    it('generates correct URL for Genesis', () => {
      const url = getCommentaryUrl('mhm', 'gen', 1);
      expect(url).toBe('https://www.studylight.org/commentaries/eng/mhm/genesis-1.html');
    });

    it('generates correct URL for numbered books', () => {
      const url = getCommentaryUrl('geb', '1co', 13);
      expect(url).toBe('https://www.studylight.org/commentaries/eng/geb/1-corinthians-13.html');
    });

    it('generates correct URL for Revelation', () => {
      const url = getCommentaryUrl('bnb', 'rev', 22);
      expect(url).toBe('https://www.studylight.org/commentaries/eng/bnb/revelation-22.html');
    });
  });

  describe('bookMapping', () => {
    it('maps English book names to codes', () => {
      expect(bookMapping['genesis']).toBeDefined();
      expect(bookMapping['john']).toBeDefined();
      expect(bookMapping['revelation']).toBeDefined();
    });

    it('maps English abbreviations to codes', () => {
      expect(bookMapping['gen']).toBeDefined();
      expect(bookMapping['jn']).toBeDefined();
      expect(bookMapping['rev']).toBeDefined();
      expect(bookMapping['matt']).toBeDefined();
    });

    it('maps Chinese book names to codes', () => {
      expect(bookMapping['创世记']).toBeDefined();
      expect(bookMapping['约翰福音']).toBeDefined();
      expect(bookMapping['启示录']).toBeDefined();
    });

    it('maps Chinese abbreviations to codes', () => {
      expect(bookMapping['创']).toBeDefined();
      expect(bookMapping['约']).toBeDefined();
      expect(bookMapping['启']).toBeDefined();
      expect(bookMapping['太']).toBeDefined();
    });

    it('numbered books work in multiple formats', () => {
      // 1 Corinthians should be accessible in multiple ways
      const corCode = bookMapping['1 corinthians'];
      expect(corCode).toBeDefined();
      expect(bookMapping['1cor']).toBe(corCode);
      expect(bookMapping['1co']).toBe(corCode);
    });

    it('all mapped codes are valid 3-letter codes', () => {
      const validCodes = new Set();
      for (const value of Object.values(bookMapping)) {
        validCodes.add(value);
      }
      // Every code should be a string of 3 characters
      for (const code of validCodes) {
        expect(typeof code).toBe('string');
        expect(code.length).toBe(3);
      }
    });
  });
});
