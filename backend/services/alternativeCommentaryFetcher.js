import axios from 'axios';
import * as cheerio from 'cheerio';

export class AlternativeCommentaryFetcher {
  constructor() {
    this.cache = new Map();
    this.lastRequestTime = 0;
    this.minDelay = 1000; // 1 second minimum between requests
  }

  async delay(ms) {
    const jitter = ms * 0.2 * (Math.random() - 0.5);
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
  }

  async ensureDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      await this.delay(this.minDelay - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  // Fetch commentary from Bible Hub (actual commentary, not just verse text)
  async fetchFromBibleHub(book, chapter, verse = null) {
    const bookMap = {
      'genesis': 'genesis', 'gen': 'genesis',
      'exodus': 'exodus', 'exod': 'exodus',
      'leviticus': 'leviticus', 'lev': 'leviticus',
      'numbers': 'numbers', 'num': 'numbers',
      'deuteronomy': 'deuteronomy', 'deut': 'deuteronomy',
      'matthew': 'matthew', 'matt': 'matthew', 'mt': 'matthew',
      'mark': 'mark', 'mk': 'mark',
      'luke': 'luke', 'lk': 'luke',
      'john': 'john', 'jn': 'john',
      'acts': 'acts',
      'romans': 'romans', 'rom': 'romans',
      '1corinthians': '1_corinthians', '1cor': '1_corinthians',
      '2corinthians': '2_corinthians', '2cor': '2_corinthians',
      'galatians': 'galatians', 'gal': 'galatians',
      'ephesians': 'ephesians', 'eph': 'ephesians',
      'philippians': 'philippians', 'phil': 'philippians',
      'colossians': 'colossians', 'col': 'colossians',
      '1thessalonians': '1_thessalonians', '1thess': '1_thessalonians',
      '2thessalonians': '2_thessalonians', '2thess': '2_thessalonians',
      '1timothy': '1_timothy', '1tim': '1_timothy',
      '2timothy': '2_timothy', '2tim': '2_timothy',
      'titus': 'titus', 'tit': 'titus',
      'philemon': 'philemon', 'phlm': 'philemon',
      'hebrews': 'hebrews', 'heb': 'hebrews',
      'james': 'james', 'jas': 'james',
      '1peter': '1_peter', '1pet': '1_peter',
      '2peter': '2_peter', '2pet': '2_peter',
      '1john': '1_john', '1jn': '1_john',
      '2john': '2_john', '2jn': '2_john',
      '3john': '3_john', '3jn': '3_john',
      'jude': 'jude',
      'revelation': 'revelation', 'rev': 'revelation'
    };

    const bibleHubBook = bookMap[book.toLowerCase()];
    if (!bibleHubBook) {
      throw new Error(`Book ${book} not found in Bible Hub mapping`);
    }

    // Bible Hub stores commentaries at specific URLs for each commentary author
    const commentaryTypes = [
      { code: 'barnes', name: "Barnes' Notes" },
      { code: 'clarke', name: "Clarke's Commentary" },
      { code: 'gill', name: "Gill's Exposition" },
      { code: 'henry', name: "Matthew Henry's Commentary" },
      { code: 'jfb', name: "Jamieson-Fausset-Brown" }
    ];

    const cacheKey = `biblehub-${bibleHubBook}-${chapter}-${verse || 'all'}`;
    
    if (this.cache.has(cacheKey)) {
      console.log(`Using cached Bible Hub commentary for ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    await this.ensureDelay();

    const commentaries = {};
    let successCount = 0;
    
    // Try to fetch from multiple commentary sources
    for (const commentary of commentaryTypes.slice(0, 2)) { // Limit to 2 for speed
      try {
        const url = `https://biblehub.com/commentaries/${commentary.code}/${bibleHubBook}/${chapter}.htm`;
        console.log(`Fetching ${commentary.name} from Bible Hub...`);
        
        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        const $ = cheerio.load(response.data);
        
        // Extract commentary text from Bible Hub
        let commentaryText = '';
        
        // Bible Hub has different structures, try multiple selectors
        const contentSelectors = [
          '.commenttext',
          '.vcomment', 
          '.text',
          '.chap',
          'p:contains("commentary")',
          'div:contains("verse")'
        ];
        
        for (const selector of contentSelectors) {
          const content = $(selector).text().trim();
          if (content && content.length > commentaryText.length) {
            commentaryText = content;
          }
        }
        
        // If no specific content found, extract all paragraph text
        if (!commentaryText || commentaryText.length < 200) {
          const paragraphs = [];
          $('p').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 50 && 
                !text.includes('Bible Hub') && 
                !text.includes('Copyright') &&
                !text.includes('Navigation')) {
              paragraphs.push(text);
            }
          });
          commentaryText = paragraphs.slice(0, 10).join('\n\n');
        }
        
        if (commentaryText && commentaryText.length > 100) {
          commentaries[commentary.name] = commentaryText.substring(0, 3000); // Limit length
          successCount++;
        }
        
        // Add delay between requests
        if (successCount < commentaryTypes.length - 1) {
          await this.delay(500);
        }
        
      } catch (error) {
        console.log(`Failed to fetch ${commentary.name}: ${error.message}`);
      }
    }
    
    const result = {
      source: 'Bible Hub Commentaries',
      book: bibleHubBook,
      chapter,
      verse,
      commentaries,
      retrievedAt: new Date().toISOString()
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  // Main method to try multiple sources
  async fetchCommentary(book, chapter, verse = null) {
    const errors = [];
    
    // Try Bible Hub first (best commentary source)
    try {
      const result = await this.fetchFromBibleHub(book, chapter, verse);
      if (result.commentaries && Object.keys(result.commentaries).length > 0) {
        console.log(`✅ Bible Hub successful: ${Object.keys(result.commentaries).length} commentaries`);
        return result;
      }
    } catch (error) {
      errors.push(`Bible Hub: ${error.message}`);
      console.log('Bible Hub failed...');
    }

    // All sources failed - return a helpful fallback
    console.log('All commentary sources failed, returning guidance message');
    return {
      source: 'Guidance Note',
      commentaries: {
        'Study Guide Note': `Commentary sources are currently unavailable for ${book} ${chapter}${verse ? `:${verse}` : ''}. For this passage, consider consulting: Matthew Henry's Commentary, Barnes' Notes, John Gill's Exposition, Jamieson-Fausset-Brown Commentary, or Calvin's Commentary. These are trusted evangelical commentaries that provide verse-by-verse exposition.`
      },
      errors
    };
  }

  clearCache() {
    this.cache.clear();
  }
}