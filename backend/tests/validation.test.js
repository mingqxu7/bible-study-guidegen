import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  validateVerseInput,
  validateTheology,
  validateLanguage,
  validateSelectedCommentaries,
  validateTheologicalStances,
  VALID_THEOLOGIES,
} from '../middleware/validation.js';

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('removes null bytes', () => {
    expect(sanitizeString('he\0llo')).toBe('hello');
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeString(long, 500).length).toBe(500);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString(42)).toBe('');
  });
});

describe('validateVerseInput', () => {
  it('accepts valid English input', () => {
    const result = validateVerseInput('John 3:16');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('John 3:16');
  });

  it('accepts valid Chinese input', () => {
    const result = validateVerseInput('约 3:16', 'zh');
    expect(result.valid).toBe(true);
  });

  it('rejects empty input', () => {
    expect(validateVerseInput('').valid).toBe(false);
    expect(validateVerseInput(null).valid).toBe(false);
    expect(validateVerseInput(undefined).valid).toBe(false);
  });

  it('rejects too-short input', () => {
    expect(validateVerseInput('ab').valid).toBe(false);
  });

  it('rejects HTML tags', () => {
    const result = validateVerseInput('<script>alert("xss")</script>');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  it('rejects javascript: protocol', () => {
    const result = validateVerseInput('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });

  it('returns Chinese error messages when language is zh', () => {
    const result = validateVerseInput('', 'zh');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('请输入经文');
  });
});

describe('validateTheology', () => {
  it('accepts all valid theologies', () => {
    for (const t of VALID_THEOLOGIES) {
      expect(validateTheology(t).valid).toBe(true);
    }
  });

  it('rejects invalid theology', () => {
    expect(validateTheology('buddhism').valid).toBe(false);
    expect(validateTheology('random').valid).toBe(false);
  });

  it('rejects empty theology', () => {
    expect(validateTheology('').valid).toBe(false);
    expect(validateTheology(null).valid).toBe(false);
  });

  it('provides Chinese error message when language is zh', () => {
    const result = validateTheology('invalid', 'zh');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('无效的神学立场');
  });

  it('lists available options in error message', () => {
    const result = validateTheology('invalid', 'en');
    expect(result.error).toContain('calvinism');
    expect(result.error).toContain('arminianism');
  });
});

describe('validateLanguage', () => {
  it('accepts "en"', () => {
    const result = validateLanguage('en');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('en');
  });

  it('accepts "zh" variants', () => {
    expect(validateLanguage('zh').normalized).toBe('zh');
    expect(validateLanguage('zh-CN').normalized).toBe('zh');
    expect(validateLanguage('zh-TW').normalized).toBe('zh');
  });

  it('defaults to "en" when empty', () => {
    expect(validateLanguage('').valid).toBe(true);
    expect(validateLanguage('').normalized).toBe('en');
    expect(validateLanguage(null).valid).toBe(true);
    expect(validateLanguage(null).normalized).toBe('en');
  });

  it('rejects unsupported languages', () => {
    const result = validateLanguage('fr');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported');
  });
});

describe('validateSelectedCommentaries', () => {
  it('accepts null/undefined (optional parameter)', () => {
    expect(validateSelectedCommentaries(null).valid).toBe(true);
    expect(validateSelectedCommentaries(undefined).valid).toBe(true);
    expect(validateSelectedCommentaries(null).parsed).toBeNull();
  });

  it('accepts valid JSON object', () => {
    const result = validateSelectedCommentaries('{"cal": true, "mhm": false}');
    expect(result.valid).toBe(true);
    expect(result.parsed.cal).toBe(true);
    expect(result.parsed.mhm).toBe(false);
  });

  it('accepts pre-parsed object', () => {
    const result = validateSelectedCommentaries({ cal: true });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = validateSelectedCommentaries('{not valid json}');
    expect(result.valid).toBe(false);
  });

  it('rejects arrays', () => {
    const result = validateSelectedCommentaries('["cal", "mhm"]');
    expect(result.valid).toBe(false);
  });

  it('rejects non-boolean values', () => {
    const result = validateSelectedCommentaries('{"cal": "yes"}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('boolean');
  });
});

describe('validateTheologicalStances', () => {
  it('accepts null/undefined (optional parameter)', () => {
    expect(validateTheologicalStances(null).valid).toBe(true);
  });

  it('accepts valid JSON array', () => {
    const stances = JSON.stringify([{ id: 'calvinism', name: 'Calvinism', description: 'Reformed' }]);
    const result = validateTheologicalStances(stances);
    expect(result.valid).toBe(true);
    expect(result.parsed).toHaveLength(1);
  });

  it('accepts pre-parsed array', () => {
    const result = validateTheologicalStances([{ id: 'calvinism' }]);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = validateTheologicalStances('{not array}');
    expect(result.valid).toBe(false);
  });

  it('rejects non-array JSON', () => {
    const result = validateTheologicalStances('{"key": "value"}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('array');
  });
});
