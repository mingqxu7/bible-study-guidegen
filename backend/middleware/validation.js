/**
 * Input validation middleware for Bible Study Guide Generator API.
 * 
 * Provides reusable validators for query/body parameters with
 * bilingual (EN/ZH) error messages.
 */

// Allowed theological stance IDs matching commentaryMapping keys
const VALID_THEOLOGIES = ['calvinism', 'arminianism', 'dispensationalism', 'lutheranism', 'catholicism'];

// Allowed language codes
const VALID_LANGUAGES = ['en', 'zh', 'zh-CN', 'zh-TW'];

/**
 * Sanitize a string input: trim, remove null bytes, limit length.
 */
export function sanitizeString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\0/g, '')  // Remove null bytes
    .slice(0, maxLength);
}

/**
 * Validate verse input string format (basic pre-check before full parsing).
 * Returns { valid, error } object.
 */
export function validateVerseInput(verseInput, language = 'en') {
  if (!verseInput || typeof verseInput !== 'string') {
    return {
      valid: false,
      error: language.startsWith('zh')
        ? '请输入经文引用（例如："约 3:16"）'
        : 'Please enter a verse reference (e.g., "John 3:16")'
    };
  }

  const sanitized = sanitizeString(verseInput, 200);

  if (sanitized.length < 3) {
    return {
      valid: false,
      error: language.startsWith('zh')
        ? '经文引用太短'
        : 'Verse reference is too short'
    };
  }

  // Check for potentially malicious input (no HTML/script tags)
  if (/<[^>]*>/.test(sanitized) || /javascript:/i.test(sanitized)) {
    return {
      valid: false,
      error: language.startsWith('zh')
        ? '经文引用包含无效字符'
        : 'Verse reference contains invalid characters'
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validate theology selection.
 */
export function validateTheology(theology, language = 'en') {
  if (!theology || typeof theology !== 'string') {
    return {
      valid: false,
      error: language.startsWith('zh')
        ? '请选择神学立场'
        : 'Please select a theological perspective'
    };
  }

  if (!VALID_THEOLOGIES.includes(theology)) {
    return {
      valid: false,
      error: language.startsWith('zh')
        ? `无效的神学立场。可选：${VALID_THEOLOGIES.join(', ')}`
        : `Invalid theological perspective. Options: ${VALID_THEOLOGIES.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate language parameter.
 */
export function validateLanguage(language) {
  if (!language) return { valid: true, normalized: 'en' };
  
  const normalized = language.trim().toLowerCase();
  
  // Accept any language starting with 'zh' as Chinese
  if (normalized.startsWith('zh')) {
    return { valid: true, normalized: 'zh' };
  }
  
  if (normalized === 'en') {
    return { valid: true, normalized: 'en' };
  }

  return {
    valid: false,
    error: `Unsupported language: ${language}. Supported: en, zh`
  };
}

/**
 * Validate selectedCommentaries JSON parameter.
 * Should be an object with string keys and boolean values, e.g. { "cal": true, "mhm": false }
 */
export function validateSelectedCommentaries(raw) {
  if (!raw) return { valid: true, parsed: null };

  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {
      valid: false,
      error: 'Invalid selectedCommentaries JSON format'
    };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'selectedCommentaries must be a JSON object'
    };
  }

  // Validate values are booleans
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'boolean') {
      return {
        valid: false,
        error: `selectedCommentaries values must be booleans, got ${typeof value} for key "${key}"`
      };
    }
  }

  return { valid: true, parsed };
}

/**
 * Validate theologicalStances JSON parameter.
 * Should be an array of objects with { id, name, description }.
 */
export function validateTheologicalStances(raw) {
  if (!raw) return { valid: true, parsed: [] };

  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {
      valid: false,
      error: 'Invalid theologicalStances JSON format'
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'theologicalStances must be a JSON array'
    };
  }

  return { valid: true, parsed };
}

/**
 * Express middleware that validates the SSE study guide request query params.
 */
export function validateStudyGuideRequest(req, res, next) {
  const { verseInput, selectedTheology, language = 'en' } = req.query;
  const errors = [];

  const langResult = validateLanguage(language);
  if (!langResult.valid) {
    errors.push(langResult.error);
  }

  const lang = langResult.normalized || 'en';

  const verseResult = validateVerseInput(verseInput, lang);
  if (!verseResult.valid) {
    errors.push(verseResult.error);
  }

  const theologyResult = validateTheology(selectedTheology, lang);
  if (!theologyResult.valid) {
    errors.push(theologyResult.error);
  }

  if (errors.length > 0) {
    if (req.headers.accept?.includes('text/event-stream')) {
      // SSE format
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ error: errors.join('; ') })}\n\n`);
      res.end();
    } else {
      // Regular JSON response
      res.status(400).json({ error: errors.join('; '), errors });
    }
    return;
  }

  // Attach sanitized values to request
  req.validatedParams = {
    verseInput: verseResult.sanitized || sanitizeString(verseInput),
    selectedTheology,
    language: lang
  };

  next();
}

// Export the valid theology list for reference
export { VALID_THEOLOGIES, VALID_LANGUAGES };
