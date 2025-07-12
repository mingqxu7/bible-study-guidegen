import axios from 'axios';
import * as cheerio from 'cheerio';
import { commentaryMapping, getCommentaryUrl, bookMapping } from './commentaryMapping.js';

export class CommentaryRetriever {
  constructor() {
    this.cache = new Map();
    this.requestDelay = 500; // Reduced delay for serverless (500ms)
  }

  // Helper function to get error messages in the specified language
  getErrorMessage(type, params, language = 'en') {
    const messages = {
      en: {
        specifyChapter: `Please specify chapter and verses, not just the book. For example: "${params.bookName} 1:1-10" or "${params.bookName}1:1-10"`,
        specifyVerses: `Please specify verses, not just chapter. For example: "${params.bookName} ${params.chapter}:1-10" or "${params.bookName}${params.chapter}:1-10"`,
        unknownBook: `Unknown book: ${params.bookName}`,
        invalidFormat: `Invalid verse format: ${params.input}. Supported formats: "John 3:16", "Matthew 5:1-12", "太:10:4-8", "太5:1-12", "哥前 7:24-40"`
      },
      zh: {
        specifyChapter: `请指定章节和经文，不只是书卷。例如："${params.bookName} 1:1-10" 或 "${params.bookName}1:1-10"`,
        specifyVerses: `请指定经文，不只是章节。例如："${params.bookName} ${params.chapter}:1-10" 或 "${params.bookName}${params.chapter}:1-10"`,
        unknownBook: `未知的书卷：${params.bookName}`,
        invalidFormat: `经文格式无效：${params.input}。支持的格式："约 3:16"、"太 5:1-12"、"太:10:4-8"、"太5:1-12"、"哥前 7:24-40"`
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
    
    return result;
  }

  // Parse verse reference (e.g., "John 3:16", "Matthew 5:1-12", "Romans 8:28-39", "太:10:4-8", "太5:1-12", "哥前 7:24-40")
  parseVerseReference(verseInput, language = 'en') {
    // Handle Chinese format with colon like "太:10:4-8" or "马太福音:10:4-8"
    const chineseWithColonMatch = verseInput.match(/^([^\d\s:]+):(\d+)(?::(\d+)(?:-(\d+))?)?$/);
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
    const chineseWithSpaceMatch = verseInput.match(/^([^\d\s:]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
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
    const chineseNoColonMatch = verseInput.match(/^([^\d\s]+)(\d+)(?::(\d+)(?:-(\d+))?)?$/);
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
    const englishMatch = verseInput.match(/^(\d*\s*\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
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
    const url = getCommentaryUrl(commentaryCode, book, chapter);
    const cacheKey = `${commentaryCode}-${book}-${chapter}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      console.log(`Fetching commentary from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 5000, // Reduced timeout for serverless
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

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
      
      // Add delay to be respectful to the server
      await this.delay(this.requestDelay);
      
      return commentaryText;

    } catch (error) {
      console.error(`Error fetching commentary from ${url}:`, error.message);
      return `Error retrieving commentary: ${error.message}`;
    }
  }

  // Get commentaries for a specific denomination and passage
  async getCommentariesForDenomination(denomination, verseReference, maxCommentaries = 3, language = 'en') {
    try {
      const parsedVerse = this.parseVerseReference(verseReference, language);
      const commentaries = commentaryMapping[denomination];
      
      if (!commentaries) {
        throw new Error(`Unknown denomination: ${denomination}`);
      }

      const results = [];
      const failedCommentaries = [];
      
      console.log(`Retrieving commentaries for ${denomination} on ${verseReference}`);
      
      // Fetch commentaries sequentially to avoid overwhelming the server
      // Limit to maxCommentaries number of commentaries
      const limitedCommentaries = commentaries.slice(0, maxCommentaries);
      
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

  // Helper method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clear cache if needed
  clearCache() {
    this.cache.clear();
  }
}