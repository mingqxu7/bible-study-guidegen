import axios from 'axios';
import * as cheerio from 'cheerio';
import { commentaryMapping, getCommentaryUrl, bookMapping } from './commentaryMapping.js';
import { getBookBounds, isValidChapter, isValidVerse, getMaxVerse } from './bibleBounds.js';
import { AlternativeCommentaryFetcher } from './alternativeCommentaryFetcher.js';

export class CommentaryRetriever {
  constructor() {
    this.cache = new Map();
    this.requestDelay = 1500; // Increased delay to avoid rate limiting (1.5s)
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
    ];
    this.alternativeFetcher = new AlternativeCommentaryFetcher();
    this.useAlternativeSources = process.env.USE_ALTERNATIVE_SOURCES === 'true' || false;
    this.blockedCount = 0; // Track how many times we've been blocked
  }

  // Get a random user agent
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  // Apply exponential backoff delay
  async applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Increase delay if making frequent requests
    if (this.requestCount > 5) {
      this.requestDelay = Math.min(this.requestDelay * 1.5, 10000); // Max 10s delay
    }
    
    // Wait if not enough time has passed
    if (timeSinceLastRequest < this.requestDelay) {
      await this.delay(this.requestDelay - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
    
    // Reset request count after a period of inactivity
    if (timeSinceLastRequest > 60000) { // 1 minute
      this.requestCount = 1;
      this.requestDelay = 1500; // Reset to base delay
    }
  }

  // Helper function to get error messages in the specified language
  getErrorMessage(type, params, language = 'en') {
    const messages = {
      en: {
        specifyChapter: `Please specify chapter and verses, not just the book. For example: "${params.bookName} 1:1-10" or "${params.bookName}1:1-10"`,
        specifyVerses: `Please specify verses, not just chapter. For example: "${params.bookName} ${params.chapter}:1-10" or "${params.bookName}${params.chapter}:1-10"`,
        unknownBook: `Unknown book: ${params.bookName}`,
        invalidFormat: `Invalid verse format: ${params.input}. Supported formats: "John 3:16", "Matthew 5:1-12", "太:10:4-8", "太5:1-12", "哥前 7:24-40"`,
        invalidChapter: `Invalid chapter number: ${params.bookName} has only ${params.maxChapter} chapters, but chapter ${params.chapter} was specified.`,
        invalidStartVerse: `Invalid start verse: ${params.bookName} ${params.chapter} has only ${params.maxVerse} verses, but verse ${params.startVerse} was specified.`,
        invalidEndVerse: `Invalid end verse: ${params.bookName} ${params.chapter} has only ${params.maxVerse} verses, but verse ${params.endVerse} was specified.`,
        invalidVerseRange: `Invalid verse range: Start verse ${params.startVerse} cannot be greater than end verse ${params.endVerse}.`
      },
      zh: {
        specifyChapter: `请指定章节和经文，不只是书卷。例如："${params.bookName} 1:1-10" 或 "${params.bookName}1:1-10"`,
        specifyVerses: `请指定经文，不只是章节。例如："${params.bookName} ${params.chapter}:1-10" 或 "${params.bookName}${params.chapter}:1-10"`,
        unknownBook: `未知的书卷：${params.bookName}`,
        invalidFormat: `经文格式无效：${params.input}。支持的格式："约 3:16"、"太 5:1-12"、"太:10:4-8"、"太：5:1-12"、"太5:1-12"、"哥前 7:24-40"`,
        invalidChapter: `无效的章节号：${params.bookName} 只有 ${params.maxChapter} 章，但指定了第 ${params.chapter} 章。`,
        invalidStartVerse: `无效的起始节数：${params.bookName} ${params.chapter} 章只有 ${params.maxVerse} 节，但指定了第 ${params.startVerse} 节。`,
        invalidEndVerse: `无效的结束节数：${params.bookName} ${params.chapter} 章只有 ${params.maxVerse} 节，但指定了第 ${params.endVerse} 节。`,
        invalidVerseRange: `无效的经文范围：起始节 ${params.startVerse} 不能大于结束节 ${params.endVerse}。`
      }
    };
    
    return messages[language]?.[type] || messages.en[type];
  }

  // Helper function to validate parsed verse reference
  validateParsedReference(result, verseInput, language = 'en') {
    // Check if only book name was provided (no chapter)
    if (!result.chapter) {
      throw new Error(this.getErrorMessage('specifyChapter', { bookName: result.bookName }, language));
    }
    
    // Check if only chapter was provided (no verses)
    if (!result.startVerse) {
      throw new Error(this.getErrorMessage('specifyVerses', { bookName: result.bookName, chapter: result.chapter }, language));
    }
    
    // Get book bounds for validation
    const bounds = getBookBounds(result.book);
    if (!bounds) {
      throw new Error(this.getErrorMessage('unknownBook', { bookName: result.bookName }, language));
    }
    
    // Validate chapter number
    if (!isValidChapter(result.book, result.chapter)) {
      throw new Error(this.getErrorMessage('invalidChapter', { 
        bookName: result.bookName, 
        chapter: result.chapter, 
        maxChapter: bounds.chapters 
      }, language));
    }
    
    // Get max verse for this chapter
    const maxVerse = getMaxVerse(result.book, result.chapter);
    
    // Validate start verse
    if (!isValidVerse(result.book, result.chapter, result.startVerse)) {
      throw new Error(this.getErrorMessage('invalidStartVerse', { 
        bookName: result.bookName, 
        chapter: result.chapter, 
        startVerse: result.startVerse, 
        maxVerse: maxVerse 
      }, language));
    }
    
    // Validate end verse if provided
    if (result.endVerse) {
      if (!isValidVerse(result.book, result.chapter, result.endVerse)) {
        throw new Error(this.getErrorMessage('invalidEndVerse', { 
          bookName: result.bookName, 
          chapter: result.chapter, 
          endVerse: result.endVerse, 
          maxVerse: maxVerse 
        }, language));
      }
      
      // Validate verse range
      if (result.startVerse > result.endVerse) {
        throw new Error(this.getErrorMessage('invalidVerseRange', { 
          startVerse: result.startVerse, 
          endVerse: result.endVerse 
        }, language));
      }
    }
    
    return result;
  }

  // Parse verse reference (e.g., "John 3:16", "Matthew 5:1-12", "Romans 8:28-39", "太:10:4-8", "太：5:1-12", "太5:1-12", "哥前 7:24-40")
  parseVerseReference(verseInput, language = 'en') {
    // Normalize wide colons to narrow colons for consistent parsing
    const normalizedInput = verseInput.replace(/：/g, ':');
    // Handle Chinese format with colon like "太:10:4-8", "太：10:4-8" or "马太福音:10:4-8"
    const chineseWithColonMatch = normalizedInput.match(/^([^\d\s:]+):(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (chineseWithColonMatch) {
      const [, bookName, chapter, startVerse, endVerse] = chineseWithColonMatch;
      const normalizedBook = bookName.trim();
      const bookCode = bookMapping[normalizedBook];
      
      if (!bookCode) {
        throw new Error(this.getErrorMessage('unknownBook', { bookName }, language));
      }

      return this.validateParsedReference({
        book: bookCode,
        bookName: bookName,
        chapter: parseInt(chapter),
        startVerse: startVerse ? parseInt(startVerse) : null,
        endVerse: endVerse ? parseInt(endVerse) : null
      }, verseInput, language);
    }

    // Handle Chinese format with space like "哥前 7:24-40" or "马太福音 5:1-12"
    const chineseWithSpaceMatch = normalizedInput.match(/^([^\d\s:]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (chineseWithSpaceMatch) {
      const [, bookName, chapter, startVerse, endVerse] = chineseWithSpaceMatch;
      const normalizedBook = bookName.trim();
      const bookCode = bookMapping[normalizedBook];
      
      if (bookCode) {
        return this.validateParsedReference({
          book: bookCode,
          bookName: bookName,
          chapter: parseInt(chapter),
          startVerse: startVerse ? parseInt(startVerse) : null,
          endVerse: endVerse ? parseInt(endVerse) : null
        }, verseInput, language);
      }
    }

    // Handle Chinese format without colon like "太5:1-12" or "马太福音5:1-12"
    const chineseNoColonMatch = normalizedInput.match(/^([^\d\s]+)(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (chineseNoColonMatch) {
      const [, bookName, chapter, startVerse, endVerse] = chineseNoColonMatch;
      const normalizedBook = bookName.trim();
      const bookCode = bookMapping[normalizedBook];
      
      if (bookCode) {
        return this.validateParsedReference({
          book: bookCode,
          bookName: bookName,
          chapter: parseInt(chapter),
          startVerse: startVerse ? parseInt(startVerse) : null,
          endVerse: endVerse ? parseInt(endVerse) : null
        }, verseInput, language);
      }
    }

    // Handle English format like "John 3:16" or "Matthew 5:1-12"
    const englishMatch = normalizedInput.match(/^(\d*\s*\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
    if (englishMatch) {
      const [, bookName, chapter, startVerse, endVerse] = englishMatch;
      const normalizedBook = bookName.toLowerCase().trim();
      const bookCode = bookMapping[normalizedBook];
      
      if (!bookCode) {
        throw new Error(this.getErrorMessage('unknownBook', { bookName }, language));
      }

      return this.validateParsedReference({
        book: bookCode,
        bookName: bookName,
        chapter: parseInt(chapter),
        startVerse: startVerse ? parseInt(startVerse) : null,
        endVerse: endVerse ? parseInt(endVerse) : null
      }, verseInput, language);
    }

    throw new Error(this.getErrorMessage('invalidFormat', { input: verseInput }, language));
  }

  // Fetch commentary content from StudyLight.org
  async fetchCommentary(commentaryCode, book, chapter, startVerse = null, endVerse = null) {
    const originalUrl = getCommentaryUrl(commentaryCode, book, chapter);
    const cacheKey = `${commentaryCode}-${book}-${chapter}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`Using cached commentary for ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    // Apply rate limiting before making request (less aggressive with ScraperAPI)
    if (!process.env.SCRAPERAPI_KEY) {
      await this.applyRateLimit();
    }

    let retries = 2; // Reduced retries to fallback faster
    let lastError = null;
    let useScraperAPI = !!process.env.SCRAPERAPI_KEY;

    while (retries > 0) {
      try {
        let url;
        let requestConfig;
        
        // Use ScraperAPI if key is available and enabled
        if (useScraperAPI && process.env.SCRAPERAPI_KEY) {
          console.log(`Fetching via ScraperAPI: ${originalUrl} (${retries} retries left)`);
          url = `http://api.scraperapi.com`;
          requestConfig = {
            timeout: 10000, // Reduced timeout to fallback faster
            params: {
              api_key: process.env.SCRAPERAPI_KEY,
              url: originalUrl,
              render: 'false', // We don't need JavaScript rendering
              country_code: 'us'
            },
            validateStatus: function (status) {
              return status < 500;
            }
          };
        } else {
          // Direct request
          console.log(`Fetching directly: ${originalUrl} (${retries} retries left)`);
          url = originalUrl;
          requestConfig = {
            timeout: 15000, // Increased timeout
            headers: {
              'User-Agent': this.getRandomUserAgent(),
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Cache-Control': 'max-age=0',
              'Referer': 'https://www.google.com/'
            },
            // Add proxy support if environment variable is set
            ...(process.env.PROXY_URL && {
              proxy: {
                host: process.env.PROXY_HOST,
                port: process.env.PROXY_PORT,
                auth: process.env.PROXY_AUTH ? {
                  username: process.env.PROXY_USER,
                  password: process.env.PROXY_PASS
                } : undefined
              }
            }),
            validateStatus: function (status) {
              return status < 500; // Resolve only if the status code is less than 500
            }
          };
        }
        
        const response = await axios.get(url, requestConfig);

        // Check for blocking responses
        if (response.status === 403 || response.status === 429) {
          if (useScraperAPI) {
            console.warn(`ScraperAPI returned ${response.status}. Falling back to direct request...`);
            useScraperAPI = false; // Disable ScraperAPI for next retry
            retries--;
            if (retries > 0) {
              continue; // Try again without ScraperAPI
            }
          } else {
            console.warn(`Received ${response.status} status. Implementing backoff...`);
            retries--;
            if (retries > 0) {
              // Exponential backoff
              const backoffDelay = (4 - retries) * 3000; // 3s, 6s, 9s
              console.log(`Waiting ${backoffDelay}ms before retry...`);
              await this.delay(backoffDelay);
              continue;
            }
          }
          throw new Error(`Access blocked (${response.status}). Please try again later.`);
        }

        if (response.status === 404) {
          throw new Error(`Commentary not found for ${book} ${chapter}`);
        }
        
        // Check for ScraperAPI specific errors
        if (useScraperAPI && response.data) {
          // ScraperAPI returns JSON errors sometimes
          if (typeof response.data === 'object' && response.data.error) {
            console.error(`ScraperAPI error: ${response.data.error}`);
            useScraperAPI = false;
            retries--;
            if (retries > 0) {
              console.log('Retrying without ScraperAPI...');
              continue;
            }
            throw new Error(`ScraperAPI error: ${response.data.error}`);
          }
        }

      const $ = cheerio.load(response.data);
      
      // First, remove all script, style, and navigation elements
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('.navigation').remove();
      $('.header').remove();
      $('.footer').remove();
      $('.sidebar').remove();
      $('.menu').remove();
      $('.advertisement').remove();
      $('[class*="cookie"]').remove();
      $('[class*="popup"]').remove();
      $('[id*="cookie"]').remove();
      
      // Convert entire page to text, preserving line breaks
      let commentaryText = '';
      
      // Function to recursively extract text with proper formatting
      const extractText = (element) => {
        const $elem = $(element);
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';
        
        // Skip certain elements
        if (['script', 'style', 'noscript'].includes(tagName)) {
          return '';
        }
        
        let text = '';
        
        // Add line breaks for block elements
        const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'tr'];
        const isBlock = blockElements.includes(tagName);
        
        // Process children
        if (element.children && element.children.length > 0) {
          element.children.forEach(child => {
            text += extractText(child);
          });
        } else if (element.type === 'text') {
          // This is a text node
          const nodeText = element.data ? element.data.trim() : '';
          if (nodeText) {
            text += nodeText + ' ';
          }
        }
        
        // Add newlines for block elements
        if (isBlock && text.trim()) {
          text = '\n' + text.trim() + '\n';
        }
        
        return text;
      };
      
      // Look for main content area first
      const mainContentSelectors = [
        '.content',
        '.commentary',
        '#commentary',
        '.main-content',
        '#main-content',
        'article',
        'main',
        '.article-content',
        '[role="main"]'
      ];
      
      let contentFound = false;
      for (const selector of mainContentSelectors) {
        const mainContent = $(selector).first();
        if (mainContent.length > 0) {
          const extractedText = extractText(mainContent[0]);
          if (extractedText.length > 500) {
            commentaryText = extractedText;
            contentFound = true;
            break;
          }
        }
      }
      
      // If no main content found, extract from body
      if (!contentFound) {
        commentaryText = extractText($('body')[0]);
      }
      
      // Clean up the extracted text
      commentaryText = commentaryText
        // Remove multiple spaces
        .replace(/ +/g, ' ')
        // Remove space at start of lines
        .replace(/\n\s+/g, '\n')
        // Collapse multiple newlines to max 2
        .replace(/\n{3,}/g, '\n\n')
        // Remove leading/trailing whitespace
        .trim();
      
      // Additional cleanup to remove common non-content patterns
      const linesToRemove = [
        /^\s*\d+\s*$/, // Just numbers
        /^\s*[a-z]\s*$/, // Single letters
        /cookie/i,
        /javascript/i,
        /your browser/i,
        /please enable/i,
        /^\s*×\s*$/, // Close buttons
        /^\s*→\s*$/, // Arrows
        /^\s*©.*$/,  // Copyright
        /^\s*\|\s*$/, // Single pipes
        /advertisement/i,
        /^Buscar/,
        /^Enter query/,
        /^Resource Toolbox/,
        /^Additional Authors/,
        /^Whole Bible/,
        /^New Testament/,
        /^Gospels Only/,
        /^Individual Books/,
        /Commentary$/,
        /^return to.*Top of Page/,
        /^Footnotes:/,
        /^Copyright Statement/,
        /^Bibliographical Information/,
        /^Lectionary Calendar/,
        /^Attention!/,
        /click here to learn more/i,
        /^Home »/,
        /Bible Commentaries.*»/,
        /^\w+day, \w+ \d+/,  // Date patterns
        /\.org/,
        /\.com/,
        /^For \d+¢/,
        /Scofield's Notes$/,
        /^1 Corinthians 1Co \d+/,
        /See Scofield/,
      ];
      
      // Also remove lines that are just navigation or metadata
      const navigationPatterns = [
        /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,
        /^(January|February|March|April|May|June|July|August|September|October|November|December)/,
        /\d{4} the Week of/,
        /Proper \d+.*Ordinary \d+/,
        /video advertis/i,
        /^Versión impresa/,
        /^Resumen/,
        /^Derechos de autor/,
        /^Bibliografía/,
      ];
      
      const lines = commentaryText.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 3) return false;
        
        // Check against all removal patterns
        for (const pattern of [...linesToRemove, ...navigationPatterns]) {
          if (pattern.test(trimmed)) return false;
        }
        
        // Remove lines that are just author names from the list
        if (trimmed.endsWith("'s Commentary") || 
            trimmed.endsWith("'s Notes") ||
            trimmed.endsWith("Commentary") && trimmed.split(' ').length <= 3) {
          return false;
        }
        
        return true;
      });
      
      commentaryText = filteredLines.join('\n');
      
      // Log extraction results
      console.log(`Extracted commentary length: ${commentaryText.length} characters`);
      if (commentaryText.length < 500) {
        console.log('Warning: Short commentary extracted. First 500 chars:', commentaryText.substring(0, 500));
      }

      // Filter for specific verses if requested
      if (startVerse && commentaryText) {
        commentaryText = this.filterCommentaryByVerses(commentaryText, startVerse, endVerse);
      }

      if (!commentaryText) {
        console.warn(`No commentary content found for ${url}`);
        commentaryText = `Commentary not available for ${book} ${chapter} from this source.`;
      }

      console.log('Commentary Text:', commentaryText);
        // Cache the result
        this.cache.set(cacheKey, commentaryText);
        
        // Success - reset request delay
        if (this.requestCount > 5) {
          this.requestDelay = Math.max(1500, this.requestDelay * 0.9); // Gradually reduce delay on success
        }
        
        return commentaryText;

      } catch (error) {
        console.error(`Error fetching commentary: ${error.message}`);
        lastError = error;
        
        // If timeout with ScraperAPI, try without it
        if (error.code === 'ECONNABORTED' && useScraperAPI) {
          console.log('ScraperAPI timeout, trying direct request...');
          useScraperAPI = false;
          retries--;
          if (retries > 0) {
            continue;
          }
        } else {
          retries--;
          if (retries > 0 && !error.message.includes('not found')) {
            const backoffDelay = (4 - retries) * 2000;
            console.log(`Error occurred, waiting ${backoffDelay}ms before retry...`);
            await this.delay(backoffDelay);
          }
        }
      }
    }

    // All retries exhausted
    console.error(`StudyLight fetch failed after all retries. Last error: ${lastError?.message}`);
    
    // Track blocking
    if (lastError?.message?.includes('Access blocked')) {
      this.blockedCount++;
      console.warn(`Blocked count increased to ${this.blockedCount}`);
    }
    
    // Try alternative sources if StudyLight is blocked or timing out
    if (this.blockedCount > 0 || this.useAlternativeSources || lastError?.message?.includes('Access blocked') || lastError?.message?.includes('timeout')) {
      console.log('Attempting to fetch from alternative sources...');
      try {
        const alternativeResult = await this.alternativeFetcher.fetchCommentary(book, chapter, startVerse);
        
        // Format the alternative result to match expected format
        let formattedContent = `[Alternative Source: ${alternativeResult.source}]\n\n`;
        
        if (alternativeResult.commentaries) {
          // Bible Hub format
          for (const [title, content] of Object.entries(alternativeResult.commentaries)) {
            formattedContent += `${title}:\n${content}\n\n`;
          }
        } else if (alternativeResult.passageText) {
          // Bible Gateway format
          formattedContent += `Passage Text:\n${alternativeResult.passageText}\n\n`;
          if (alternativeResult.studyNotes?.length > 0) {
            formattedContent += `Study Notes:\n${alternativeResult.studyNotes.join('\n')}\n`;
          }
        }
        
        // Cache the result
        this.cache.set(cacheKey, formattedContent);
        
        return formattedContent;
      } catch (altError) {
        console.error(`Alternative source also failed: ${altError.message}`);
        return `Error retrieving commentary from all sources. StudyLight: ${lastError?.message}. Alternative: ${altError.message}`;
      }
    }
    
    return `Error retrieving commentary: ${lastError?.message || 'Unknown error after retries'}`;
  }

  // Get commentaries for a specific denomination and passage
  async getCommentariesForDenomination(denomination, verseReference, maxCommentaries = 3, language = 'en', selectedCommentaries = null, maxVerses = 15) {
    try {
      const parsedVerse = this.parseVerseReference(verseReference, language);
      
      // Check verse count limit
      const verseCount = parsedVerse.endVerse ? (parsedVerse.endVerse - parsedVerse.startVerse + 1) : 1;
      if (verseCount > maxVerses) {
        const errorMessage = language === 'zh' || language === 'zh-CN' || language.startsWith('zh') 
          ? `所选经文包含 ${verseCount} 节，超过了最大限制。请选择不超过 ${maxVerses} 节的经文。`
          : `Selected passage contains ${verseCount} verses, which exceeds the maximum limit. Please select no more than ${maxVerses} verses.`;
        return {
          error: errorMessage,
          verseCount: verseCount,
          maxVerses: maxVerses
        };
      }
      
      const commentaries = commentaryMapping[denomination];
      
      if (!commentaries) {
        throw new Error(`Unknown denomination: ${denomination}`);
      }

      const results = [];
      const failedCommentaries = [];
      
      console.log(`Retrieving commentaries for ${denomination} on ${verseReference}`);
      console.log('Selected commentaries received:', selectedCommentaries);
      
      // Filter commentaries based on selection or use default behavior
      let commentariesToFetch;
      if (selectedCommentaries && Object.keys(selectedCommentaries).length > 0) {
        // Use only selected commentaries
        commentariesToFetch = commentaries.filter(c => selectedCommentaries[c.code]);
        console.log(`Using selected commentaries: ${commentariesToFetch.map(c => c.name).join(', ')}`);
      } else {
        // Default: use first maxCommentaries
        commentariesToFetch = commentaries.slice(0, maxCommentaries);
        console.log(`Using default first ${maxCommentaries} commentaries`);
      }
      
      // Limit to maxCommentaries
      const limitedCommentaries = commentariesToFetch.slice(0, maxCommentaries);
      
      for (const commentary of limitedCommentaries) {
        try {
          const content = await this.fetchCommentary(
            commentary.code, 
            parsedVerse.book, 
            parsedVerse.chapter,
            parsedVerse.startVerse,
            parsedVerse.endVerse
          );
          
          // Only include commentary if it doesn't start with "Error retrieving commentary"
          if (!content.startsWith('Error retrieving commentary:')) {
            results.push({
              name: commentary.name,
              author: commentary.author,
              code: commentary.code,
              content: content,
              source: `StudyLight.org - ${commentary.name}`,
              url: getCommentaryUrl(commentary.code, parsedVerse.book, parsedVerse.chapter),
              success: true
            });
            console.log(`Successfully retrieved ${commentary.name}`);
          } else {
            failedCommentaries.push({
              name: commentary.name,
              author: commentary.author,
              error: content,
              success: false
            });
            console.warn(`Filtered out failed commentary: ${commentary.name}`);
          }
        } catch (error) {
          console.error(`Failed to retrieve ${commentary.name}:`, error.message);
          failedCommentaries.push({
            name: commentary.name,
            author: commentary.author,
            error: error.message,
            success: false
          });
        }
      }

      return {
        denomination,
        passage: verseReference,
        parsedVerse,
        commentaries: results,
        failedCommentaries: failedCommentaries,
        retrievedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error in getCommentariesForDenomination:', error);
      throw error;
    }
  }

  // Filter commentary text to focus on specific verses
  filterCommentaryByVerses(commentaryText, startVerse, endVerse = null) {
    if (!startVerse) return commentaryText;
    
    const targetEnd = endVerse || startVerse;
    const sections = [];
    const lines = commentaryText.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      // Look for verse section headers: "Verses X-Y", "Verses X", or "Verse X"
      const verseHeaderMatch = line.match(/^Verses?\s+(\d+)(?:-(\d+))?/i);
      
      if (verseHeaderMatch) {
        // Save previous section if it exists
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Parse verse range from header
        const sectionStart = parseInt(verseHeaderMatch[1]);
        const sectionEnd = verseHeaderMatch[2] ? parseInt(verseHeaderMatch[2]) : sectionStart;
        
        // Check if this section overlaps with target range
        const hasOverlap = (sectionStart <= targetEnd && sectionEnd >= startVerse);
        
        currentSection = {
          startVerse: sectionStart,
          endVerse: sectionEnd,
          lines: [line],
          includeInResult: hasOverlap
        };
      } else if (currentSection) {
        // Add line to current section
        currentSection.lines.push(line);
      } else {
        // No section header found yet, this might be introductory text
        // Create a default section to capture it
        if (!currentSection) {
          currentSection = {
            startVerse: null,
            endVerse: null,
            lines: [line],
            includeInResult: false // Don't include introductory text unless no specific sections match
          };
        } else {
          currentSection.lines.push(line);
        }
      }
    }
    
    // Don't forget the last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // Filter sections that should be included
    const relevantSections = sections.filter(section => section.includeInResult);
    
    if (relevantSections.length > 0) {
      // Combine relevant sections
      const filteredText = relevantSections
        .map(section => section.lines.join('\n'))
        .join('\n\n')
        .trim();
      
      return filteredText;
    }
    
    // If no specific verse sections were found, check if any section contains verse references
    const fallbackSections = [];
    for (const section of sections) {
      const sectionText = section.lines.join('\n');
      // Look for verse references in the text (e.g., "verse 5", "v. 5", "verses 1-3")
      const verseReferences = sectionText.match(/(?:verses?|v\.)\s*(\d+)(?:-(\d+))?/gi);
      
      if (verseReferences) {
        for (const ref of verseReferences) {
          const refMatch = ref.match(/(?:verses?|v\.)\s*(\d+)(?:-(\d+))?/i);
          if (refMatch) {
            const refStart = parseInt(refMatch[1]);
            const refEnd = refMatch[2] ? parseInt(refMatch[2]) : refStart;
            
            // Check if referenced verses overlap with target
            if (refStart <= targetEnd && refEnd >= startVerse) {
              fallbackSections.push(section);
              break;
            }
          }
        }
      }
    }
    
    if (fallbackSections.length > 0) {
      const filteredText = fallbackSections
        .map(section => section.lines.join('\n'))
        .join('\n\n')
        .trim();
      
      return filteredText;
    }
    
    // Check if there are any verse sections at all
    const hasVerseContent = sections.some(section => 
      section.startVerse !== null && section.startVerse !== undefined
    );
    
    if (hasVerseContent) {
      // There are verse sections, but none match the requested range
      const availableVerses = sections
        .filter(s => s.startVerse !== null)
        .map(s => s.startVerse === s.endVerse ? `${s.startVerse}` : `${s.startVerse}-${s.endVerse}`)
        .join(', ');
      
      return `No commentary available for verses ${startVerse}${endVerse && endVerse !== startVerse ? `-${endVerse}` : ''}. This commentary only covers verses: ${availableVerses}`;
    }
    
    // No verse sections found at all - might be a general commentary
    const cleanedText = commentaryText.trim();
    if (cleanedText.length > 100) {
      return `General commentary (no specific verse breakdown available):\n\n${cleanedText}`;
    }
    
    // No useful content found
    return `No commentary available for verses ${startVerse}${endVerse && endVerse !== startVerse ? `-${endVerse}` : ''} in this source.`;
  }

  // Helper method for delays with jitter
  delay(ms) {
    // Add random jitter (±20%) to avoid pattern detection
    const jitter = ms * 0.2 * (Math.random() - 0.5);
    const actualDelay = Math.max(100, ms + jitter);
    return new Promise(resolve => setTimeout(resolve, actualDelay));
  }

  // Clear cache if needed
  clearCache() {
    this.cache.clear();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.requestDelay = 1500;
  }
}