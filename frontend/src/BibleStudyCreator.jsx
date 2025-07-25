import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, Search, Download, Users, Cross, MessageSquare, Globe, CheckCircle, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, HelpCircle, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Use relative path for API which works for both development (with Vite proxy) and production (Vercel)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Bible Reference Hover Component
const BibleReferenceHover = ({ children, language = 'en' }) => {
  const [hoverData, setHoverData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [activeReference, setActiveReference] = useState(null);
  const [mobileVerseData, setMobileVerseData] = useState({}); // Store verses for mobile display
  const [loadingMobileVerses, setLoadingMobileVerses] = useState({});
  const timeoutRef = useRef(null);
  const tooltipRef = useRef(null);
  
  // Detect if device is mobile (iOS or Android)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Bible book name mappings
  const bookMapping = {
    // English books
    'genesis': 1, 'gen': 1, 'ge': 1, 'gn': 1,
    'exodus': 2, 'exod': 2, 'ex': 2, 'exo': 2,
    'leviticus': 3, 'lev': 3, 'le': 3, 'lv': 3,
    'numbers': 4, 'num': 4, 'nu': 4, 'nm': 4, 'nb': 4,
    'deuteronomy': 5, 'deut': 5, 'de': 5, 'dt': 5,
    'joshua': 6, 'josh': 6, 'jos': 6, 'jsh': 6,
    'judges': 7, 'judg': 7, 'jdg': 7, 'jg': 7, 'jdgs': 7,
    'ruth': 8, 'rth': 8, 'ru': 8,
    '1 samuel': 9, '1sam': 9, '1sm': 9, '1sa': 9, '1 sam': 9, 'i samuel': 9,
    '2 samuel': 10, '2sam': 10, '2sm': 10, '2sa': 10, '2 sam': 10, 'ii samuel': 10,
    '1 kings': 11, '1kgs': 11, '1kg': 11, '1ki': 11, 'i kings': 11,
    '2 kings': 12, '2kgs': 12, '2kg': 12, '2ki': 12, 'ii kings': 12,
    '1 chronicles': 13, '1chron': 13, '1ch': 13, '1chr': 13, '1 chron': 13, 'i chronicles': 13,
    '2 chronicles': 14, '2chron': 14, '2ch': 14, '2chr': 14, '2 chron': 14, 'ii chronicles': 14,
    'ezra': 15, 'ezr': 15, 'ez': 15,
    'nehemiah': 16, 'neh': 16, 'ne': 16,
    'esther': 17, 'esth': 17, 'es': 17,
    'job': 18, 'jb': 18,
    'psalms': 19, 'psalm': 19, 'ps': 19, 'psa': 19, 'psm': 19, 'pss': 19,
    'proverbs': 20, 'prov': 20, 'pr': 20, 'prv': 20,
    'ecclesiastes': 21, 'eccles': 21, 'eccl': 21, 'ec': 21, 'ecc': 21,
    'song of songs': 22, 'song': 22, 'so': 22, 'sos': 22, 'canticle': 22, 'canticles': 22,
    'isaiah': 23, 'isa': 23, 'is': 23,
    'jeremiah': 24, 'jer': 24, 'je': 24, 'jr': 24,
    'lamentations': 25, 'lam': 25, 'la': 25,
    'ezekiel': 26, 'ezek': 26, 'eze': 26, 'ezk': 26,
    'daniel': 27, 'dan': 27, 'da': 27, 'dn': 27,
    'hosea': 28, 'hos': 28, 'ho': 28,
    'joel': 29, 'joe': 29, 'jl': 29,
    'amos': 30, 'am': 30,
    'obadiah': 31, 'obad': 31, 'ob': 31,
    'jonah': 32, 'jnh': 32, 'jon': 32,
    'micah': 33, 'mic': 33, 'mc': 33,
    'nahum': 34, 'nah': 34, 'na': 34,
    'habakkuk': 35, 'hab': 35, 'hb': 35,
    'zephaniah': 36, 'zeph': 36, 'zep': 36, 'zp': 36,
    'haggai': 37, 'hag': 37, 'hg': 37,
    'zechariah': 38, 'zech': 38, 'zec': 38, 'zc': 38,
    'malachi': 39, 'mal': 39, 'ml': 39,
    'matthew': 40, 'matt': 40, 'mt': 40,
    'mark': 41, 'mk': 41, 'mar': 41,
    'luke': 42, 'lk': 42, 'luk': 42,
    'john': 43, 'jn': 43, 'joh': 43,
    'acts': 44, 'ac': 44, 'act': 44,
    'romans': 45, 'rom': 45, 'ro': 45, 'rm': 45,
    '1 corinthians': 46, '1cor': 46, '1co': 46, '1 cor': 46, 'i corinthians': 46,
    '2 corinthians': 47, '2cor': 47, '2co': 47, '2 cor': 47, 'ii corinthians': 47,
    'galatians': 48, 'gal': 48, 'ga': 48,
    'ephesians': 49, 'eph': 49, 'ep': 49,
    'philippians': 50, 'phil': 50, 'php': 50, 'pp': 50,
    'colossians': 51, 'col': 51, 'co': 51,
    '1 thessalonians': 52, '1thess': 52, '1th': 52, '1 thess': 52, 'i thessalonians': 52,
    '2 thessalonians': 53, '2thess': 53, '2th': 53, '2 thess': 53, 'ii thessalonians': 53,
    '1 timothy': 54, '1tim': 54, '1ti': 54, '1 tim': 54, 'i timothy': 54,
    '2 timothy': 55, '2tim': 55, '2ti': 55, '2 tim': 55, 'ii timothy': 55,
    'titus': 56, 'tit': 56, 'ti': 56,
    'philemon': 57, 'phlm': 57, 'phm': 57,
    'hebrews': 58, 'heb': 58, 'he': 58,
    'james': 59, 'jas': 59, 'jm': 59,
    '1 peter': 60, '1pet': 60, '1pe': 60, '1 pet': 60, 'i peter': 60,
    '2 peter': 61, '2pet': 61, '2pe': 61, '2 pet': 61, 'ii peter': 61,
    '1 john': 62, '1jn': 62, '1jo': 62, 'i john': 62,
    '2 john': 63, '2jn': 63, '2jo': 63, 'ii john': 63,
    '3 john': 64, '3jn': 64, '3jo': 64, 'iii john': 64,
    'jude': 65, 'jd': 65,
    'revelation': 66, 'rev': 66, 're': 66,
    // Chinese books
    '创': 1, '创世记': 1, '创世纪': 1,
    '出': 2, '出埃及记': 2,
    '利': 3, '利未记': 3,
    '民': 4, '民数记': 4,
    '申': 5, '申命记': 5,
    '书': 6, '约书亚记': 6,
    '士': 7, '士师记': 7,
    '得': 8, '路得记': 8,
    '撒上': 9, '撒母耳记上': 9,
    '撒下': 10, '撒母耳记下': 10,
    '王上': 11, '列王纪上': 11,
    '王下': 12, '列王纪下': 12,
    '代上': 13, '历代志上': 13,
    '代下': 14, '历代志下': 14,
    '拉': 15, '以斯拉记': 15,
    '尼': 16, '尼希米记': 16,
    '斯': 17, '以斯帖记': 17,
    '伯': 18, '约伯记': 18,
    '诗': 19, '诗篇': 19,
    '箴': 20, '箴言': 20,
    '传': 21, '传道书': 21,
    '歌': 22, '雅歌': 22,
    '赛': 23, '以赛亚书': 23,
    '耶': 24, '耶利米书': 24,
    '哀': 25, '耶利米哀歌': 25,
    '结': 26, '以西结书': 26,
    '但': 27, '但以理书': 27,
    '何': 28, '何西阿书': 28,
    '珥': 29, '约珥书': 29,
    '摩': 30, '阿摩司书': 30,
    '俄': 31, '俄巴底亚书': 31,
    '拿': 32, '约拿书': 32,
    '弥': 33, '弥迦书': 33,
    '鸿': 34, '那鸿书': 34,
    '哈': 35, '哈巴谷书': 35,
    '番': 36, '西番雅书': 36,
    '该': 37, '哈该书': 37,
    '亚': 38, '撒迦利亚书': 38,
    '玛': 39, '玛拉基书': 39,
    '太': 40, '马太福音': 40,
    '可': 41, '马可福音': 41,
    '路': 42, '路加福音': 42,
    '约': 43, '约翰福音': 43,
    '徒': 44, '使徒行传': 44,
    '罗': 45, '罗马书': 45,
    '林前': 46, '哥林多前书': 46,
    '林后': 47, '哥林多后书': 47,
    '加': 48, '加拉太书': 48,
    '弗': 49, '以弗所书': 49,
    '腓': 50, '腓立比书': 50,
    '西': 51, '歌罗西书': 51,
    '帖前': 52, '帖撒罗尼迦前书': 52,
    '帖后': 53, '帖撒罗尼迦后书': 53, '帖後': 53,
    '提前': 54, '提摩太前书': 54,
    '提后': 55, '提摩太后书': 55, '提後': 55,
    '多': 56, '提多书': 56,
    '门': 57, '腓利门书': 57,
    '来': 58, '希伯来书': 58,
    '雅': 59, '雅各书': 59,
    '彼前': 60, '彼得前书': 60,
    '彼后': 61, '彼得后书': 61,
    '约一': 62, '约翰一书': 62, '约壹': 62,
    '约二': 63, '约翰二书': 63, '约贰': 63,
    '约三': 64, '约翰三书': 64, '约叁': 64,
    '犹': 65, '犹大书': 65,
    '启': 66, '启示录': 66
  };

  // Parse Bible reference from text
  const parseBibleReference = (text) => {
    // Match patterns like "John 3:16", "Matthew 5:1-12", "太 3:16", "约一 2:1-3"
    const patterns = [
      // English: "John 3:16", "1 Corinthians 13:4-8"
      /\b(\d*\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)(?:-(\d+))?\b/g,
      // Chinese: "太 3:16", "林前 13:4-8", "约一 2:1"
      /([\u4e00-\u9fff]+)\s*(\d+):(\d+)(?:-(\d+))?/g,
      // Chinese with colon: "太：3:16"
      /([\u4e00-\u9fff]+)[：:]\s*(\d+):(\d+)(?:-(\d+))?/g
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        const [, bookName, chapter, startVerse, endVerse] = match;
        const normalizedBook = bookName.toLowerCase().trim();
        const bookNumber = bookMapping[normalizedBook];
        
        if (bookNumber) {
          return {
            book: bookNumber,
            chapter: parseInt(chapter),
            startVerse: parseInt(startVerse),
            endVerse: endVerse ? parseInt(endVerse) : null,
            original: match[0]
          };
        }
      }
    }
    return null;
  };

  // Fetch Bible text from Bolls API
  const fetchBibleText = async (book, chapter, startVerse, endVerse) => {
    try {
      const version = language.startsWith('zh') ? 'CUV' : 'ESV';
      const url = `https://bolls.life/get-text/${version}/${book}/${chapter}/`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      
      // Filter to specific verses if needed
      let verses = data;
      if (startVerse) {
        verses = data.filter(v => {
          const verseNum = v.verse;
          if (endVerse) {
            return verseNum >= startVerse && verseNum <= endVerse;
          }
          return verseNum === startVerse;
        });
      }
      
      return verses.map(v => `${v.verse}. ${v.text}`).join(' ');
    } catch (error) {
      console.error('Error fetching Bible text:', error);
      return 'Failed to load verse text';
    }
  };

  // Handle click on Bible reference
  const handleReferenceClick = async (e, referenceText) => {
    e.preventDefault();
    e.stopPropagation();
    
    const reference = parseBibleReference(referenceText);
    if (!reference) return;

    // Mobile behavior - toggle inline verse display
    if (isMobile) {
      // If clicking the same reference, toggle it off
      if (mobileVerseData[referenceText]) {
        setMobileVerseData(prev => {
          const newData = { ...prev };
          delete newData[referenceText];
          return newData;
        });
        return;
      }

      // Load verse for mobile display
      setLoadingMobileVerses(prev => ({ ...prev, [referenceText]: true }));
      try {
        const text = await fetchBibleText(
          reference.book,
          reference.chapter,
          reference.startVerse,
          reference.endVerse
        );
        
        setMobileVerseData(prev => ({
          ...prev,
          [referenceText]: {
            reference: referenceText,
            text: text,
            verses: reference.endVerse ? 
              `${reference.startVerse}-${reference.endVerse}` : 
              reference.startVerse.toString()
          }
        }));
      } catch (error) {
        console.error('Error loading verse:', error);
      } finally {
        setLoadingMobileVerses(prev => {
          const newLoading = { ...prev };
          delete newLoading[referenceText];
          return newLoading;
        });
      }
      return;
    }

    // Desktop behavior - show tooltip
    // If clicking the same reference, close it
    if (activeReference === referenceText && hoverData) {
      setHoverData(null);
      setActiveReference(null);
      setIsLoading(false);
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Smart positioning logic - position tooltip very close to the reference
    const rect = e.target.getBoundingClientRect();
    
    // Use regular viewport dimensions for mobile compatibility
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    
    const tooltipWidth = Math.min(400, viewportWidth - 20); // Responsive width for mobile
    const tooltipMaxHeight = Math.min(300, viewportHeight * 0.4); // Max 40% of viewport height
    
    // Calculate position relative to viewport for better mobile support
    let x = rect.left;
    let y = rect.bottom; // Position directly below the reference
    
    // Adjust horizontal position to keep tooltip on screen
    if (x + tooltipWidth > viewportWidth) {
      x = Math.max(10, viewportWidth - tooltipWidth - 10);
    }
    
    // Adjust vertical position - show above if not enough space below
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow < tooltipMaxHeight && spaceAbove > spaceBelow) {
      // Show above the reference
      y = Math.max(10, rect.top - tooltipMaxHeight);
    } else if (spaceBelow < tooltipMaxHeight) {
      // Center in viewport if neither position works well
      y = Math.max(10, (viewportHeight - tooltipMaxHeight) / 2);
    }

    setPosition({ x, y });
    setActiveReference(referenceText);

    setIsLoading(true);
    // Determine if showing above based on calculated position
    const showAbove = y === Math.max(10, rect.top - tooltipMaxHeight);
    setHoverData({ reference, text: '', showAbove });

    try {
      const text = await fetchBibleText(
        reference.book,
        reference.chapter,
        reference.startVerse,
        reference.endVerse
      );
      // Keep the same showAbove value from initial calculation
      setHoverData(prev => ({ ...prev, text }));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mouse enter for desktop hover experience (optional)
  const handleMouseEnter = (e, referenceText) => {
    // Only show on hover if no active click tooltip and not on mobile
    if (!isMobile && !activeReference && !('ontouchstart' in window)) {
      handleReferenceClick(e, referenceText);
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    // Only hide on mouse leave if not clicked and not on mobile
    if (!isMobile && !activeReference) {
      timeoutRef.current = setTimeout(() => {
        setHoverData(null);
        setIsLoading(false);
      }, 300); // Small delay to allow moving to tooltip
    }
  };

  // Handle mouse enter on tooltip
  const handleTooltipEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  // Handle mouse leave on tooltip
  const handleTooltipLeave = () => {
    if (!activeReference) {
      setHoverData(null);
      setIsLoading(false);
    }
  };

  // Process children to add hover functionality to Bible references
  const processText = (text) => {
    if (typeof text !== 'string') return text;

    const patterns = [
      /\b(\d*\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)(?:-(\d+))?\b/g,
      /([\u4e00-\u9fff]+)\s*(\d+):(\d+)(?:-(\d+))?/g,
      /([\u4e00-\u9fff]+)[：:]\s*(\d+):(\d+)(?:-(\d+))?/g
    ];

    const references = [];
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      while ((match = pattern.exec(text)) !== null) {
        const [fullMatch, bookName] = match;
        const normalizedBook = bookName.toLowerCase().trim();
        if (bookMapping[normalizedBook]) {
          references.push({
            text: fullMatch,
            start: match.index,
            end: match.index + fullMatch.length
          });
        }
      }
    }

    if (references.length === 0) return text;

    // Sort by start position and merge overlapping references
    references.sort((a, b) => a.start - b.start);
    const mergedRefs = [];
    for (const ref of references) {
      if (mergedRefs.length === 0 || ref.start >= mergedRefs[mergedRefs.length - 1].end) {
        mergedRefs.push(ref);
      }
    }

    // Build the result with hoverable spans
    const result = [];
    let lastIndex = 0;

    mergedRefs.forEach((ref, i) => {
      // Add text before reference
      if (ref.start > lastIndex) {
        result.push(text.substring(lastIndex, ref.start));
      }

      // Add clickable reference
      result.push(
        <span
          key={`ref-${i}`}
          className="bible-reference text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors"
          onClick={(e) => handleReferenceClick(e, ref.text)}
          onTouchEnd={(e) => {
            e.preventDefault(); // Prevent delayed click on iOS
            handleReferenceClick(e, ref.text);
          }}
          onMouseEnter={(e) => handleMouseEnter(e, ref.text)}
          onMouseLeave={handleMouseLeave}
          title="Click to see verse text"
          role="button"
          tabIndex={0}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {ref.text}
        </span>
      );

      lastIndex = ref.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result;
  };

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeReference && tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        // Check if the click is not on a Bible reference
        const isReferenceClick = event.target.closest('.bible-reference');
        if (!isReferenceClick) {
          setHoverData(null);
          setActiveReference(null);
          setIsLoading(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [activeReference]);

  return (
    <>
      {typeof children === 'string' ? processText(children) : children}
      
      {/* Mobile: Show verses inline below the references */}
      {isMobile && Object.keys(mobileVerseData).length > 0 && (
        <div className="mt-3 space-y-3">
          {Object.entries(mobileVerseData).map(([ref, data]) => (
            <div key={ref} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm text-blue-700">
                  {data.reference}
                </div>
                <button
                  onClick={() => {
                    setMobileVerseData(prev => {
                      const newData = { ...prev };
                      delete newData[ref];
                      return newData;
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed">
                {data.text}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Show loading indicators for mobile */}
      {isMobile && Object.keys(loadingMobileVerses).length > 0 && (
        <div className="mt-3">
          {Object.keys(loadingMobileVerses).map(ref => (
            <div key={ref} className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {language.startsWith('zh') ? `加载 ${ref}...` : `Loading ${ref}...`}
            </div>
          ))}
        </div>
      )}
      
      {/* Desktop: Tooltip - render using portal to avoid stacking context issues */}
      {!isMobile && (hoverData || isLoading) && createPortal(
        <div
          ref={tooltipRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-xl p-4"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            // Remove transform to avoid positioning issues on mobile
            // transform: hoverData?.showAbove ? 'translateY(-100%)' : 'translateY(0)',
            width: window.innerWidth < 480 ? '90vw' : '400px',
            maxWidth: '90vw',
            maxHeight: `${Math.min(300, window.innerHeight * 0.4)}px`,
            zIndex: 9999, // Use explicit z-index instead of Tailwind class
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            // Ensure tooltip is visible on mobile
            position: 'fixed',
            overflow: 'visible'
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              {language.startsWith('zh') ? '加载经文...' : 'Loading verse...'}
            </div>
          ) : hoverData ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  {hoverData.reference.original}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">
                    {language.startsWith('zh') ? 'CUV' : 'ESV'}
                  </div>
                  {activeReference && (
                    <button
                      onClick={() => {
                        setHoverData(null);
                        setActiveReference(null);
                        setIsLoading(false);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Close"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div 
                className="text-sm text-gray-700 leading-relaxed overflow-y-auto"
                style={{ maxHeight: '240px' }}
              >
                {hoverData.text ? (
                  <div className="space-y-2">
                    {(() => {
                      // Better verse parsing: split by space followed by digit(s) followed by period and space
                      // This ensures we capture complete verse numbers like "10." not just "0."
                      const verses = [];
                      const versePattern = /(\d+)\.\s+([^]*?)(?=\s+\d+\.\s|$)/g;
                      let match;
                      
                      while ((match = versePattern.exec(hoverData.text)) !== null) {
                        verses.push({
                          number: match[1],
                          text: match[2].trim()
                        });
                      }
                      
                      // Fallback: if no matches found, try simpler split
                      if (verses.length === 0) {
                        const simplePattern = /^(\d+)\.\s*(.*)/;
                        const singleMatch = hoverData.text.match(simplePattern);
                        if (singleMatch) {
                          verses.push({
                            number: singleMatch[1],
                            text: singleMatch[2].trim()
                          });
                        }
                      }
                      
                      return verses.map((verse, index) => (
                        <div key={index} className="pb-2 border-l-2 border-blue-100 pl-3">
                          <div className="block">
                            <span className="font-semibold text-blue-600 mr-2">
                              {verse.number}.
                            </span>
                            <span className="text-gray-700">
                              {verse.text}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    {language.startsWith('zh') ? '未找到经文' : 'No text available'}
                  </div>
                )}
              </div>
              {/* Small arrow indicator pointing to the reference */}
              {hoverData.showAbove ? (
                <div 
                  className="absolute bottom-0 left-6 transform translate-y-full"
                >
                  <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-300"></div>
                  <div 
                    className="absolute w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-white"
                    style={{ left: '-2px', top: '-1px' }}
                  ></div>
                </div>
              ) : (
                <div 
                  className="absolute top-0 left-6 transform -translate-y-full"
                >
                  <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-300"></div>
                  <div 
                    className="absolute w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-white"
                    style={{ left: '-2px', bottom: '-1px' }}
                  ></div>
                </div>
              )}
            </>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
};

// Simple Markdown to HTML parser for reference answers
const parseMarkdownToHTML = (markdown) => {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-gray-800 mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-gray-900 mt-5 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-4">$1</h1>');
  
  // Convert bold text
  html = html.replace(/\*\*(.*)\*\*/gim, '<strong class="font-semibold text-gray-800">$1</strong>');
  
  // Convert italic text
  html = html.replace(/\*(.*)\*/gim, '<em class="italic">$1</em>');
  
  // Convert line breaks and paragraphs
  html = html.replace(/\n\n/g, '</p><p class="mb-3">');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraph tags
  html = '<p class="mb-3">' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="mb-3"><\/p>/g, '');
  
  return html;
};


const BibleStudyCreator = () => {
  const { t, i18n } = useTranslation();
  const [selectedTheology, setSelectedTheology] = useState('');
  const [verseInput, setVerseInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [error, setError] = useState('');
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [showStreamingContent, setShowStreamingContent] = useState(false);
  const [selectedCommentaries, setSelectedCommentaries] = useState({});
  const [expandedTheology, setExpandedTheology] = useState(null);
  const [referenceAnswers, setReferenceAnswers] = useState({});
  const [loadingAnswers, setLoadingAnswers] = useState({});
  const [expandedAnswers, setExpandedAnswers] = useState({});
  const [quoteTranslations, setQuoteTranslations] = useState({});
  const [loadingTranslations, setLoadingTranslations] = useState({});
  const [showTranslation, setShowTranslation] = useState({});
  const studyGuideRef = useRef(null);
  const streamingContentRef = useRef(null);
  const MAX_COMMENTARIES = 3;

  // Auto-scroll streaming content to bottom when new tokens arrive
  useEffect(() => {
    if (streamingContentRef.current && showStreamingContent) {
      streamingContentRef.current.scrollTop = streamingContentRef.current.scrollHeight;
    }
  }, [streamingContent, showStreamingContent]);

  // Scroll to study guide and focus when generation completes
  useEffect(() => {
    if (studyGuide && studyGuideRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        // Scroll the study guide into view
        studyGuideRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest' 
        });
        
        // Focus on the study guide container to make it keyboard accessible
        studyGuideRef.current.focus();
        
        // Ensure scrollbar is visible by adding a small scroll
        studyGuideRef.current.scrollTop = 1;
        studyGuideRef.current.scrollTop = 0;
        
        // For mobile devices, also scroll the parent container
        if (window.innerWidth < 768) {
          // Find the main content container and scroll it
          const mainContent = studyGuideRef.current.closest('.max-w-7xl');
          if (mainContent) {
            mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 100);
    }
  }, [studyGuide]);

  // Progress step component
  const ProgressStep = ({ step, isActive, isCompleted }) => {
    const getStepIcon = () => {
      if (isCompleted) return <CheckCircle className="w-5 h-5 text-green-600" />;
      if (isActive) return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      return <Clock className="w-5 h-5 text-gray-400" />;
    };

    const getStepStyle = () => {
      if (isCompleted) return 'border-green-200 bg-green-50';
      if (isActive) return 'border-blue-200 bg-blue-50';
      return 'border-gray-200 bg-gray-50';
    };

    return (
      <div className={`p-3 rounded-lg border ${getStepStyle()} transition-all duration-300`}>
        <div className="flex items-start gap-3">
          {getStepIcon()}
          <div className="flex-1">
            <p className={`text-sm font-medium ${isCompleted ? 'text-green-800' : isActive ? 'text-blue-800' : 'text-gray-600'}`}>
              {step.message}
            </p>
            {step.details && (
              <div className="mt-2 text-xs text-gray-600">
                {step.details.successful && (
                  <div>
                    <span className="font-medium">✓ Retrieved:</span> {step.details.successful.map(c => c.name).join(', ')}
                  </div>
                )}
                {step.details.failed && step.details.failed.length > 0 && (
                  <div className="text-red-600">
                    <span className="font-medium">✗ Failed:</span> {step.details.failed.join(', ')}
                  </div>
                )}
                {step.details.usable && (
                  <div>
                    <span className="font-medium">📖 Usable:</span> {step.details.usable.join(', ')}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {step.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Function to translate verbatim quote to Chinese
  const translateQuote = async (quoteId, quote, commentary, author) => {
    console.log('translateQuote called with:', { quoteId, quote, commentary, author });
    if (!studyGuide) {
      console.log('No study guide available');
      return;
    }
    
    setLoadingTranslations(prev => ({ ...prev, [quoteId]: true }));

    try {
      console.log('Making API call to translate quote');
      const response = await fetch(`${API_BASE_URL}/translate-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quote,
          commentary,
          author,
          passage: studyGuide.passage,
          theology: studyGuide.theology
        }),
      });

      console.log('Translation response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Translation API error response:', errorText);
        throw new Error('Failed to translate quote');
      }

      const data = await response.json();
      console.log('Translation API response data:', data);
      
      setQuoteTranslations(prev => ({ 
        ...prev, 
        [quoteId]: data.translation 
      }));
      
      setShowTranslation(prev => ({ 
        ...prev, 
        [quoteId]: true 
      }));

    } catch (error) {
      console.error('Error translating quote:', error);
      setError(t('translationFailed'));
    } finally {
      setLoadingTranslations(prev => ({ ...prev, [quoteId]: false }));
    }
  };

  // Function to generate reference answer for a discussion question
  const generateReferenceAnswer = async (questionIndex, question) => {
    console.log('generateReferenceAnswer called with:', { questionIndex, question });
    if (!studyGuide) {
      console.log('No study guide available');
      return;
    }
    
    const answerKey = `${questionIndex}`;
    console.log('Setting loading state for answer key:', answerKey);
    setLoadingAnswers(prev => ({ ...prev, [answerKey]: true }));

    try {
      // Gather context for the LLM
      const verseText = studyGuide.exegesis?.map(v => `${v.verse}: "${v.text}"`).join('\n') || '';
      const exegesis = studyGuide.exegesis?.map(v => `${v.verse}: ${v.explanation}`).join('\n\n') || '';
      const commentary = studyGuide.commentariesUsed?.map(c => `${c.name} by ${c.author}`).join(', ') || '';
      
      console.log('Making API call to:', `${API_BASE_URL}/generate-reference-answer`);
      console.log('Request payload:', { question, passage: studyGuide.passage, verseText, theology: studyGuide.theology, commentary, language: i18n.language, exegesis });
      
      const response = await fetch(`${API_BASE_URL}/generate-reference-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          passage: studyGuide.passage,
          verseText,
          theology: studyGuide.theology,
          commentary,
          language: i18n.language,
          exegesis
        }),
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error('Failed to generate reference answer');
      }

      const data = await response.json();
      console.log('API response data:', data);
      
      setReferenceAnswers(prev => ({ 
        ...prev, 
        [answerKey]: data.referenceAnswer 
      }));
      
      setExpandedAnswers(prev => ({ 
        ...prev, 
        [answerKey]: true 
      }));

    } catch (error) {
      console.error('Error generating reference answer:', error);
      setError(t('answerGenerationFailed'));
    } finally {
      setLoadingAnswers(prev => ({ ...prev, [answerKey]: false }));
    }
  };

  // Function to translate error messages from backend
  const translateError = (errorMessage) => {
    if (errorMessage.includes('Please specify verses, not just chapter') || errorMessage.includes('请指定经文，不只是章节')) {
      return t('errors.specifyVerses');
    }
    if (errorMessage.includes('Please specify chapter and verses, not just the book') || errorMessage.includes('请指定章节和经文，不只是书卷')) {
      return t('errors.specifyChapter');
    }
    if (errorMessage.includes('Unknown book') || errorMessage.includes('未知的书卷')) {
      return t('errors.unknownBook');
    }
    if (errorMessage.includes('Invalid verse format') || errorMessage.includes('经文格式无效')) {
      return t('errors.invalidFormat');
    }
    if (errorMessage.includes('Invalid chapter number') || errorMessage.includes('无效的章节号')) {
      return t('errors.invalidChapter');
    }
    if (errorMessage.includes('Invalid start verse') || errorMessage.includes('无效的起始节数')) {
      return t('errors.invalidStartVerse');
    }
    if (errorMessage.includes('Invalid end verse') || errorMessage.includes('无效的结束节数')) {
      return t('errors.invalidEndVerse');
    }
    if (errorMessage.includes('Invalid verse range') || errorMessage.includes('无效的经文范围')) {
      return t('errors.invalidVerseRange');
    }
    if (errorMessage.includes('exceeds the maximum limit') || errorMessage.includes('超过了最大限制')) {
      // Extract the verse limit from the error message if available
      const limitMatch = errorMessage.match(/(?:no more than|不超过)\s+(\d+)\s+(?:verses|节)/);
      if (limitMatch) {
        const limit = limitMatch[1];
        return i18n.language === 'zh' 
          ? `选择的经文太多，请选择不超过 ${limit} 节的经文。`
          : `Too many verses selected. Please select no more than ${limit} verses.`;
      }
      return t('errors.tooManyVerses');
    }
    // For any other backend errors, return as is (they should already be in the correct language)
    return errorMessage;
  };

  const theologicalStances = [
    { 
      id: 'calvinism', 
      name: t('theology.calvinism.name'), 
      description: t('theology.calvinism.description'),
      commentaries: [
        { name: "Calvin's Commentary", code: "cal", author: "John Calvin" },
        { name: "Matthew Henry", code: "mhm", author: "Matthew Henry" },
        { name: "John Gill", code: "geb", author: "John Gill" },
        { name: "Barnes' Notes", code: "bnb", author: "Albert Barnes" },
        { name: "Jamieson-Fausset-Brown", code: "jfb", author: "Jamieson, Fausset, Brown" }
      ]
    },
    { 
      id: 'arminianism', 
      name: t('theology.arminianism.name'), 
      description: t('theology.arminianism.description'),
      commentaries: [
        { name: "Wesley's Notes", code: "wen", author: "John Wesley" },
        { name: "Clarke's Commentary", code: "acc", author: "Adam Clarke" },
        { name: "Benson's Commentary", code: "rbc", author: "Joseph Benson" },
        { name: "Whedon's Commentary", code: "whe", author: "Daniel Whedon" }
      ]
    },
    { 
      id: 'dispensationalism', 
      name: t('theology.dispensationalism.name'), 
      description: t('theology.dispensationalism.description'),
      commentaries: [
        { name: "Scofield Reference Notes", code: "srn", author: "C.I. Scofield" },
        { name: "Darby's Synopsis", code: "dsn", author: "John Darby" },
        { name: "Ironside's Notes", code: "isn", author: "H.A. Ironside" },
        { name: "McGee's Commentary", code: "ttb", author: "J. Vernon McGee" },
        { name: "Constable's Expository Notes", code: "dcc", author: "Thomas L. Constable" }
      ]
    },
    { 
      id: 'lutheranism', 
      name: t('theology.lutheranism.name'), 
      description: t('theology.lutheranism.description'),
      commentaries: [
        { name: "Kretzmann's Commentary", code: "kpc", author: "Paul Kretzmann" },
        { name: "Bengel's Gnomon", code: "bng", author: "Johann Bengel" },
        { name: "Luther's Commentary", code: "lut", author: "Martin Luther" }
      ]
    },
    { 
      id: 'catholicism', 
      name: t('theology.catholicism.name'), 
      description: t('theology.catholicism.description'),
      commentaries: [
        { name: "Haydock's Commentary", code: "hcc", author: "George Haydock" },
        { name: "Lapide's Commentary", code: "lap", author: "Cornelius Lapide" },
        { name: "Orchard's Commentary", code: "orc", author: "Bernard Orchard" }
      ]
    }
  ];

  const generateStudyGuide = async () => {
    if (!selectedTheology || !verseInput.trim()) {
      setError(t('errors.selectBoth'));
      return;
    }

    setIsGenerating(true);
    setError('');
    setStudyGuide(null);
    setProgressSteps([]);
    setCurrentStep(null);
    setStreamingContent('');
    setShowStreamingContent(false);
    setReferenceAnswers({});
    setLoadingAnswers({});
    setExpandedAnswers({});
    setQuoteTranslations({});
    setLoadingTranslations({});
    setShowTranslation({});

    try {
      const urlParams = new URLSearchParams({
        verseInput,
        selectedTheology,
        theologicalStances: JSON.stringify(theologicalStances),
        language: i18n.language,
        selectedCommentaries: JSON.stringify(selectedCommentaries[selectedTheology] || {})
      });

      const eventSource = new EventSource(`${API_BASE_URL}/generate-study-stream?${urlParams}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            setError(translateError(data.error) || t('errors.serverError'));
            eventSource.close();
            setIsGenerating(false);
            return;
          }

          if (data.type === 'progress') {
            const newStep = {
              id: data.step,
              message: data.message,
              timestamp: new Date(),
              details: data.details || null
            };
            
            setProgressSteps(prevSteps => {
              const existingIndex = prevSteps.findIndex(step => step.id === data.step);
              if (existingIndex >= 0) {
                const updatedSteps = [...prevSteps];
                updatedSteps[existingIndex] = newStep;
                return updatedSteps;
              } else {
                return [...prevSteps, newStep];
              }
            });
            
            setCurrentStep(data.step);
            
            // Show streaming content when Claude starts generating
            if (data.step === 'generating_guide') {
              setShowStreamingContent(true);
              setStreamingContent('');
            }
          } else if (data.type === 'token') {
            // Update streaming content with new tokens
            setStreamingContent(prev => prev + data.content);
          } else if (data.type === 'complete') {
            setStudyGuide(data.data);
            setCurrentStep('completed');
            setShowStreamingContent(false);
            setStreamingContent('');
            eventSource.close();
            setIsGenerating(false);
          }
        } catch (parseError) {
          console.error('Failed to parse SSE data:', event.data);
          setError(t('errors.serverError'));
          eventSource.close();
          setIsGenerating(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        
        // Fallback to regular POST request if SSE fails
        console.log('SSE failed, falling back to regular API call...');
        fallbackToRegularAPI();
      };

      // Cleanup function
      return () => {
        eventSource.close();
      };

    } catch (error) {
      console.error('Error setting up SSE:', error);
      // Fallback to regular API call
      fallbackToRegularAPI();
    }
  };

  // Fallback function for when SSE fails
  const fallbackToRegularAPI = async () => {
    try {
      // Add a progress step for fallback
      setProgressSteps([{
        id: 'fallback',
        message: i18n.language === 'zh' ? '实时更新不可用，使用标准模式生成...' : 'Real-time updates unavailable, using standard mode...',
        timestamp: new Date(),
        details: null
      }]);
      setCurrentStep('fallback');

      const response = await fetch(`${API_BASE_URL}/generate-study`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verseInput,
          selectedTheology,
          theologicalStances,
          language: i18n.language,
          selectedCommentaries: selectedCommentaries[selectedTheology] || {}
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate study guide';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || `Server error: ${response.status}`;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      let studyData;
      try {
        studyData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response format from server');
      }
      
      setStudyGuide(studyData);
      setCurrentStep('completed');
      setIsGenerating(false);
    } catch (error) {
      console.error('Error in fallback API call:', error);
      setError(translateError(error.message) || t('errors.serverError'));
      setIsGenerating(false);
    }
  };

  const exportToPDF = () => {
    if (!studyGuide) return;

    try {
      // Helper functions
      const safeString = (value) => typeof value === 'string' ? value : '';
      const safeArray = (value) => Array.isArray(value) ? value : [];

      // Create filename for the window title
      const passageText = studyGuide.passage || verseInput;
      const baseFilename = passageText
        .replace(/[:\s]/g, '_')
        .replace(/[^\w\u4e00-\u9fff_-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      const studyGuideText = i18n.language.startsWith('zh') ? '学习指南' : 'Study Guide';
      const documentTitle = `${baseFilename} ${studyGuideText}`;

      // Build complete HTML document
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${documentTitle}</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.5;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            h1 { font-size: 24px; color: #2c3e50; margin: 0 0 10px 0; }
            h2 { font-size: 20px; color: #2c3e50; margin: 20px 0 15px 0; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
            h3 { font-size: 16px; color: #34495e; margin: 15px 0 8px 0; }
            h4 { font-size: 14px; color: #34495e; margin: 10px 0 5px 0; font-weight: bold; }
            p { margin: 0 0 10px 0; text-align: justify; }
            ul, ol { margin: 0; padding-left: 20px; }
            li { margin-bottom: 5px; }
            blockquote { 
              margin: 0 0 10px 0; 
              padding: 10px; 
              background: #f8f9fa; 
              border-left: 3px solid #bdc3c7; 
              font-style: italic; 
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              padding: 20px; 
              background: #f8f9fa; 
              border-radius: 8px; 
            }
            .section { 
              margin-bottom: 30px; 
              padding: 20px; 
              border: 1px solid #e0e0e0; 
              border-radius: 8px; 
            }
            .verse-block { 
              margin-bottom: 20px; 
              padding-left: 15px; 
              border-left: 3px solid #3498db; 
            }
            .verse-title { 
              font-size: 18px; 
              color: #2980b9; 
              font-weight: bold; 
              margin: 0 0 10px 0; 
            }
            .question-number { 
              color: #2980b9; 
              font-weight: bold; 
            }
            .commentary { 
              margin-bottom: 10px; 
              padding: 10px; 
              background: white; 
              border-radius: 4px; 
            }
            .commentary-section { 
              background: #f8f9fa; 
            }
            .footer { 
              text-align: center; 
              margin-top: 40px; 
              padding: 20px; 
              background: #f8f9fa; 
              border-radius: 8px; 
              font-size: 12px; 
              color: #7f8c8d; 
            }
            .print-button {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #3498db;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
              z-index: 1000;
            }
            .print-button:hover {
              background: #2980b9;
            }
            @media print {
              .print-button { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-button no-print" onclick="window.print()">
            ${i18n.language === 'zh' ? '打印/保存为PDF' : 'Print/Save as PDF'}
          </button>
          
          <div class="header">
            <h1>${safeString(studyGuide.title)}</h1>
            <p style="font-size: 18px; color: #3498db; font-weight: bold; margin: 0 0 5px 0;">${safeString(studyGuide.passage)}</p>
            <p style="font-size: 14px; color: #7f8c8d; margin: 0;">${safeString(studyGuide.theology)} ${t('perspective')}</p>
          </div>
      `;

      // Overview Section
      if (studyGuide.overview) {
        htmlContent += `
          <div class="section">
            <h2>${t('overview')}</h2>
            <div style="margin-bottom: 15px;">
              <h3>${t('introduction')}</h3>
              <p>${safeString(studyGuide.overview.introduction)}</p>
            </div>
            <div style="margin-bottom: 15px;">
              <h3>${t('historicalContext')}</h3>
              <p>${safeString(studyGuide.overview.historicalContext)}</p>
            </div>
            <div>
              <h3>${t('literaryContext')}</h3>
              <p>${safeString(studyGuide.overview.literaryContext)}</p>
            </div>
          </div>
        `;
      }

      // Exegesis Section
      if (studyGuide.exegesis && Array.isArray(studyGuide.exegesis)) {
        htmlContent += `<div class="section"><h2>${t('exegesis')}</h2>`;
        
        studyGuide.exegesis.forEach(verse => {
          htmlContent += `
            <div class="verse-block">
              <div class="verse-title">${safeString(verse.verse)}</div>
              ${verse.text ? `<blockquote>"${safeString(verse.text)}"</blockquote>` : ''}
              <p>${safeString(verse.explanation)}</p>
          `;
          
          if (verse.keyInsights && Array.isArray(verse.keyInsights) && verse.keyInsights.length > 0) {
            htmlContent += `
              <div style="margin-bottom: 10px;">
                <h4>${t('keyInsights')}</h4>
                <ul>
            `;
            verse.keyInsights.forEach(insight => {
              htmlContent += `<li>${safeString(insight)}</li>`;
            });
            htmlContent += `</ul></div>`;
          }
          
          if (verse.verbatimQuotes && Array.isArray(verse.verbatimQuotes) && verse.verbatimQuotes.length > 0) {
            htmlContent += `
              <div style="margin-bottom: 10px;">
                <h4>${t('commentaryQuotes') || 'Commentary Quotes'}</h4>
            `;
            verse.verbatimQuotes.forEach(quote => {
              htmlContent += `
                <div style="margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-left: 3px solid #4f46e5; border-radius: 4px;">
                  <blockquote style="margin: 0; font-style: italic; color: #4b5563;">
                    "${safeString(quote.quote)}"
                  </blockquote>
                  <p style="margin-top: 5px; font-size: 0.875rem; color: #6b7280;">
                    — ${safeString(quote.author)}, <em>${safeString(quote.commentary)}</em>
                  </p>
                </div>
              `;
            });
            htmlContent += `</div>`;
          }
          
          if (verse.crossReferences && Array.isArray(verse.crossReferences) && verse.crossReferences.length > 0) {
            htmlContent += `
              <div>
                <h4>${t('crossReferences')}</h4>
                <p style="font-size: 12px; color: #7f8c8d;">${verse.crossReferences.join(' • ')}</p>
              </div>
            `;
          }
          
          htmlContent += `</div>`;
        });
        
        htmlContent += `</div>`;
      }

      // Discussion Questions
      if (studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions)) {
        htmlContent += `<div class="section"><h2>${t('discussionQuestions')}</h2>`;
        
        studyGuide.discussionQuestions.forEach((question, index) => {
          const answerKey = `${index}`;
          htmlContent += `
            <div style="margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
              <div style="margin-bottom: 10px;">
                <span class="question-number">${index + 1}.</span> ${safeString(question)}
              </div>
          `;
          
          // Include reference answer if it exists
          if (referenceAnswers[answerKey]) {
            htmlContent += `
              <div style="margin-top: 15px; padding: 15px; border-left: 3px solid #3498db; background-color: #f8f9fa; border-radius: 4px;">
                <h4 style="color: #2980b9; font-size: 14px; margin: 0 0 10px 0;">${t('referenceAnswer')}</h4>
                <div style="color: #333; font-size: 12px; line-height: 1.6;">
                  ${parseMarkdownToHTML(safeString(referenceAnswers[answerKey]))}
                </div>
              </div>
            `;
          }
          
          htmlContent += `</div>`;
        });
        
        htmlContent += `</div>`;
      }

      // Life Application
      if (studyGuide.lifeApplication) {
        htmlContent += `<div class="section"><h2>${t('lifeApplication')}</h2>`;
        
        if (studyGuide.lifeApplication.practicalApplications && Array.isArray(studyGuide.lifeApplication.practicalApplications)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('practicalApplications')}</h3>
              <ul>
          `;
          studyGuide.lifeApplication.practicalApplications.forEach(app => {
            htmlContent += `<li>${safeString(app)}</li>`;
          });
          htmlContent += `</ul></div>`;
        }
        
        if (studyGuide.lifeApplication.reflectionPoints && Array.isArray(studyGuide.lifeApplication.reflectionPoints)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('reflectionPoints')}</h3>
              <ul>
          `;
          studyGuide.lifeApplication.reflectionPoints.forEach(point => {
            htmlContent += `<li>${safeString(point)}</li>`;
          });
          htmlContent += `</ul></div>`;
        }
        
        if (studyGuide.lifeApplication.actionSteps && Array.isArray(studyGuide.lifeApplication.actionSteps)) {
          htmlContent += `
            <div>
              <h3>${t('actionSteps')}</h3>
              <ol>
          `;
          studyGuide.lifeApplication.actionSteps.forEach(step => {
            htmlContent += `<li>${safeString(step)}</li>`;
          });
          htmlContent += `</ol></div>`;
        }
        
        htmlContent += `</div>`;
      }

      // Additional Resources
      if (studyGuide.additionalResources) {
        htmlContent += `<div class="section"><h2>${t('additionalResources')}</h2>`;
        
        if (studyGuide.additionalResources.crossReferences && Array.isArray(studyGuide.additionalResources.crossReferences)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('crossReferences')}</h3>
              <p>${studyGuide.additionalResources.crossReferences.join(' • ')}</p>
            </div>
          `;
        }
        
        if (studyGuide.additionalResources.memoryVerses && Array.isArray(studyGuide.additionalResources.memoryVerses)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('memoryVerses')}</h3>
              <p>${studyGuide.additionalResources.memoryVerses.join(' • ')}</p>
            </div>
          `;
        }
        
        if (studyGuide.additionalResources.prayerPoints && Array.isArray(studyGuide.additionalResources.prayerPoints)) {
          htmlContent += `
            <div>
              <h3>${t('prayerPoints')}</h3>
              <ul>
          `;
          studyGuide.additionalResources.prayerPoints.forEach(point => {
            htmlContent += `<li>${safeString(point)}</li>`;
          });
          htmlContent += `</ul></div>`;
        }
        
        htmlContent += `</div>`;
      }

      // Commentaries Used
      if (studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0) {
        htmlContent += `<div class="section commentary-section"><h2>${t('commentariesUsed')}</h2>`;
        
        studyGuide.commentariesUsed.forEach(commentary => {
          htmlContent += `
            <div class="commentary">
              <p>
                <strong style="color: #2980b9;">${safeString(commentary.citation)}</strong> 
                <strong>${safeString(commentary.name)}</strong> 
                by <em>${safeString(commentary.author)}</em>
              </p>
              ${commentary.url ? `<p style="font-size: 11px; color: #7f8c8d; margin: 5px 0 0 0;">Source: ${safeString(commentary.url)}</p>` : ''}
            </div>
          `;
        });
        
        htmlContent += `</div>`;
      }

      // Footer
      htmlContent += `
          <div class="footer">
            <p>${t('downloadHeaders.generatedBy')}</p>
          </div>
        </body>
        </html>
      `;

      // Open in new window
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Show instructions
      const message = i18n.language === 'zh' 
        ? '请在新窗口中点击"打印/保存为PDF"按钮，然后选择"另存为PDF"' 
        : 'Please click the "Print/Save as PDF" button in the new window, then choose "Save as PDF"';
      
      // Set timeout to show message after window opens
      setTimeout(() => {
        alert(message);
      }, 500);

    } catch (error) {
      console.error('PDF export failed:', error);
      alert(i18n.language === 'zh' ? 'PDF导出失败，请重试' : 'PDF export failed, please try again');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Cross className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">{t('title')}</h1>
            <Book className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
          <div className="mt-4">
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium">{i18n.language === 'en' ? '中文' : 'English'}</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              {t('studyConfig')}
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('selectTheology')}
              </label>
              <div className="space-y-3">
                {theologicalStances.map((stance) => (
                  <div
                    key={stance.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTheology === stance.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                    onClick={() => {
                      setSelectedTheology(stance.id);
                      // Only expand, never collapse when clicking the card
                      if (expandedTheology !== stance.id) {
                        setExpandedTheology(stance.id);
                      }
                      // Initialize selected commentaries for this theology if not already done
                      if (!selectedCommentaries[stance.id]) {
                        // Select first MAX_COMMENTARIES by default
                        const defaultSelected = {};
                        stance.commentaries.slice(0, MAX_COMMENTARIES).forEach(commentary => {
                          defaultSelected[commentary.code] = true;
                        });
                        setSelectedCommentaries(prev => ({ ...prev, [stance.id]: defaultSelected }));
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="theology"
                        value={stance.id}
                        checked={selectedTheology === stance.id}
                        onChange={() => {
                          setSelectedTheology(stance.id);
                          // Only expand, never collapse when selecting the radio
                          if (expandedTheology !== stance.id) {
                            setExpandedTheology(stance.id);
                          }
                          // Initialize selected commentaries for this theology if not already done
                          if (!selectedCommentaries[stance.id]) {
                            // Select first MAX_COMMENTARIES by default
                            const defaultSelected = {};
                            stance.commentaries.slice(0, MAX_COMMENTARIES).forEach(commentary => {
                              defaultSelected[commentary.code] = true;
                            });
                            setSelectedCommentaries(prev => ({ ...prev, [stance.id]: defaultSelected }));
                          }
                        }}
                        className="text-indigo-600"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-800">{stance.name}</h3>
                        <p className="text-sm text-gray-600">{stance.description}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-500">
                            {t('commentariesLabel')} {stance.commentaries.length} available
                          </p>
                          {selectedTheology === stance.id && expandedTheology !== stance.id && (
                            <div className="flex items-center text-xs text-indigo-600">
                              <span className="mr-1">{t('selectCommentaries')}</span>
                              <ChevronDown className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expandable commentary selection */}
                    {selectedTheology === stance.id && expandedTheology === stance.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          {t('selectUpTo')} {MAX_COMMENTARIES} {t('commentaries')}:
                        </p>
                        <div className="space-y-2">
                          {stance.commentaries.map((commentary) => {
                            const isSelected = selectedCommentaries[stance.id]?.[commentary.code] || false;
                            const selectedCount = Object.values(selectedCommentaries[stance.id] || {}).filter(v => v).length;
                            const isDisabled = !isSelected && selectedCount >= MAX_COMMENTARIES;
                            
                            return (
                              <label
                                key={commentary.code}
                                className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-all ${
                                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={(e) => {
                                    setSelectedCommentaries(prev => ({
                                      ...prev,
                                      [stance.id]: {
                                        ...prev[stance.id],
                                        [commentary.code]: e.target.checked
                                      }
                                    }));
                                  }}
                                  className="mt-1 text-indigo-600"
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-700">{commentary.name}</p>
                                  <p className="text-xs text-gray-500">{commentary.author}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {Object.values(selectedCommentaries[stance.id] || {}).filter(v => v).length} / {MAX_COMMENTARIES} {t('selected')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('biblePassage')}
              </label>
              <input
                type="text"
                value={verseInput}
                onChange={(e) => setVerseInput(e.target.value)}
                placeholder={t('passagePlaceholder')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('passageHint')}
              </p>
            </div>

            <button
              onClick={generateStudyGuide}
              disabled={isGenerating || !selectedTheology || !verseInput.trim()}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Search className="w-5 h-5 opacity-50" />
                  {i18n.language === 'zh' ? '正在生成...' : 'Generating...'}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t('generate')}
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                {t('studyGuide')}
              </h2>
              {studyGuide && (
                <button
                  onClick={exportToPDF}
                  className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {i18n.language === 'zh' ? '导出PDF' : 'Export PDF'}
                </button>
              )}
            </div>

            {!studyGuide && !isGenerating && (
              <div className="text-center py-12 text-gray-500">
                <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>{t('configurePrompt')}</p>
              </div>
            )}

            {isGenerating && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <Loader2 className="w-8 h-8 mx-auto mb-4 text-indigo-600 animate-spin" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {i18n.language === 'zh' ? '正在生成学习指南...' : 'Generating Study Guide...'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {i18n.language === 'zh' ? '请查看下方的详细进度信息' : 'See detailed progress information below'}
                  </p>
                </div>
                
                {progressSteps.length > 0 && (
                  <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto">
                    {progressSteps.map((step, index) => {
                      const stepOrder = ['parsing', 'parsed', 'retrieving_commentaries', 'commentaries_retrieved', 'filtering_commentaries', 'commentaries_filtered', 'generating_guide', 'fallback', 'completed'];
                      const isActive = currentStep === step.id;
                      const currentIndex = stepOrder.indexOf(currentStep);
                      const stepIndex = stepOrder.indexOf(step.id);
                      const isCompleted = stepIndex < currentIndex || currentStep === 'completed';
                      
                      return (
                        <ProgressStep 
                          key={step.id} 
                          step={step} 
                          isActive={isActive}
                          isCompleted={isCompleted}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Real-time Claude Response Display */}
                {showStreamingContent && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <h4 className="font-medium text-gray-800">
                        {i18n.language === 'zh' ? 'Claude 正在生成回应...' : 'Claude is generating response...'}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {streamingContent.length} {i18n.language === 'zh' ? '字符' : 'characters'}
                      </span>
                    </div>
                    <div 
                      ref={streamingContentRef}
                      className="bg-white border rounded p-3 max-h-64 overflow-y-auto scroll-smooth"
                    >
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                        {streamingContent}
                        <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></span>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {studyGuide && (
              <div 
                ref={studyGuideRef} 
                className="study-guide-scroll space-y-8 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                tabIndex={-1}
                style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#9CA3AF #F3F4F6',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {/* Header Section */}
                <div className="text-center bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-6 shadow-sm">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{typeof studyGuide.title === 'string' ? studyGuide.title : 'Study Guide'}</h3>
                  <p className="text-lg text-indigo-700 font-semibold mb-1">{typeof studyGuide.passage === 'string' ? studyGuide.passage : ''}</p>
                  <p className="text-sm text-gray-600 font-medium">{typeof studyGuide.theology === 'string' ? studyGuide.theology : ''} {t('perspective')}</p>
                </div>

                {/* Overview Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                    {t('overview')}
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">{t('introduction')}</h5>
                      <p className="text-gray-700 leading-relaxed">
                        {studyGuide.overview && typeof studyGuide.overview.introduction === 'string' ? studyGuide.overview.introduction : 'No introduction available'}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">{t('historicalContext')}</h5>
                      <p className="text-gray-700 leading-relaxed">
                        {studyGuide.overview && typeof studyGuide.overview.historicalContext === 'string' ? studyGuide.overview.historicalContext : 'No historical context available'}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">{t('literaryContext')}</h5>
                      <p className="text-gray-700 leading-relaxed">
                        {studyGuide.overview && typeof studyGuide.overview.literaryContext === 'string' ? studyGuide.overview.literaryContext : 'No literary context available'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verse-by-Verse Exegesis */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                    {t('exegesis')}
                  </h4>
                  <div className="space-y-6">
                    {studyGuide.exegesis && Array.isArray(studyGuide.exegesis) ? studyGuide.exegesis.map((verse, index) => (
                      <div key={index} className="border-l-4 border-indigo-200 pl-4 py-2">
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="font-bold text-indigo-700 text-lg">{typeof verse.verse === 'string' ? verse.verse : `Verse ${index + 1}`}</span>
                        </div>
                        {verse.text && (
                          <blockquote className="italic text-gray-600 mb-3 bg-gray-50 p-3 rounded">
                            "{typeof verse.text === 'string' ? verse.text : ''}"
                          </blockquote>
                        )}
                        <p className="text-gray-700 leading-relaxed mb-3">
                          {typeof verse.explanation === 'string' ? verse.explanation : 'No explanation available'}
                        </p>
                        {verse.keyInsights && Array.isArray(verse.keyInsights) && verse.keyInsights.length > 0 && (
                          <div className="mb-3">
                            <h6 className="font-semibold text-gray-800 mb-2">{t('keyInsights')}</h6>
                            <ul className="list-disc list-inside space-y-1">
                              {verse.keyInsights.map((insight, i) => (
                                <li key={i} className="text-gray-700">{insight}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {verse.verbatimQuotes && Array.isArray(verse.verbatimQuotes) && verse.verbatimQuotes.length > 0 && (
                          <div className="mb-3">
                            <h6 className="font-semibold text-gray-800 mb-2">{t('commentaryQuotes') || 'Commentary Quotes'}</h6>
                            <div className="space-y-2">
                              {verse.verbatimQuotes.map((quote, i) => {
                                const quoteId = `${index}-${i}`;
                                return (
                                  <div key={i} className="bg-gray-50 border-l-4 border-indigo-500 pl-4 pr-3 py-3 rounded-r">
                                    <div className="flex items-start justify-between mb-2">
                                      <blockquote className="italic text-gray-700 flex-1">
                                        {showTranslation[quoteId] && quoteTranslations[quoteId] ? (
                                          <span className="not-italic text-gray-800">"{quoteTranslations[quoteId]}"</span>
                                        ) : (
                                          <span>"{quote.quote}"</span>
                                        )}
                                      </blockquote>
                                      {i18n.language === 'zh' && (
                                        <button
                                          onClick={() => {
                                            console.log('Translation button clicked for quote:', quoteId);
                                            console.log('Current translation state:', { showTranslation: showTranslation[quoteId], hasTranslation: !!quoteTranslations[quoteId] });
                                            if (quoteTranslations[quoteId]) {
                                              // Translation exists in memory - just toggle display
                                              console.log('Translation exists in memory, toggling display');
                                              setShowTranslation(prev => ({ 
                                                ...prev, 
                                                [quoteId]: !prev[quoteId] 
                                              }));
                                            } else {
                                              // First time translation - call API and store
                                              console.log('No translation in memory, initiating API call');
                                              translateQuote(quoteId, quote.quote, quote.commentary, quote.author);
                                            }
                                          }}
                                          disabled={loadingTranslations[quoteId]}
                                          className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          {loadingTranslations[quoteId] ? (
                                            <>
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              {t('translating')}
                                            </>
                                          ) : showTranslation[quoteId] && quoteTranslations[quoteId] ? (
                                            <>
                                              <Languages className="w-3 h-3" />
                                              {t('showOriginal')}
                                            </>
                                          ) : (
                                            <>
                                              <Languages className="w-3 h-3" />
                                              {t('translateToChinese')}
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      — {quote.author}, <em>{quote.commentary}</em>
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {verse.crossReferences && Array.isArray(verse.crossReferences) && verse.crossReferences.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 mb-1">{t('crossReferences')}</h6>
                            <div className="text-sm text-gray-600">
                              <BibleReferenceHover language={i18n.language}>
                                {verse.crossReferences.join(' • ')}
                              </BibleReferenceHover>
                            </div>
                          </div>
                        )}
                      </div>
                    )) : <p className="text-gray-500">No exegesis available</p>}
                  </div>
                </div>

                {/* Discussion Questions */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                    {t('discussionQuestions')}
                  </h4>
                  <div className="space-y-4">
                    {studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions) ? studyGuide.discussionQuestions.map((question, index) => {
                      const answerKey = `${index}`;
                      return (
                        <div key={index} className="border border-gray-100 rounded-lg p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="font-bold text-indigo-600 flex-shrink-0 mt-1">{index + 1}.</span>
                            <p className="text-gray-700 leading-relaxed flex-1">{typeof question === 'string' ? question : 'Discussion question'}</p>
                            <button
                              onClick={() => {
                                console.log('Reference answer button clicked for question:', index, question);
                                console.log('Current referenceAnswers state:', referenceAnswers);
                                console.log('Answer key:', answerKey);
                                if (referenceAnswers[answerKey]) {
                                  console.log('Answer exists, toggling expanded state');
                                  setExpandedAnswers(prev => ({ 
                                    ...prev, 
                                    [answerKey]: !prev[answerKey] 
                                  }));
                                } else {
                                  console.log('Answer does not exist, generating new answer');
                                  generateReferenceAnswer(index, question);
                                }
                              }}
                              disabled={loadingAnswers[answerKey]}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {loadingAnswers[answerKey] ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  {t('generatingAnswer')}
                                </>
                              ) : (
                                <>
                                  <HelpCircle className="w-3 h-3" />
                                  {i18n.language === 'zh' ? '参考答案' : 'Reference Answer'}
                                </>
                              )}
                            </button>
                          </div>
                          
                          {/* Reference Answer Display */}
                          {referenceAnswers[answerKey] && expandedAnswers[answerKey] && (
                            <div className="mt-3 pl-6 border-l-2 border-blue-200 bg-blue-50 rounded-r-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="text-sm font-semibold text-blue-800">{t('referenceAnswer')}</h6>
                                <button
                                  onClick={() => setExpandedAnswers(prev => ({ 
                                    ...prev, 
                                    [answerKey]: false 
                                  }))}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  {t('hideReferenceAnswer')}
                                </button>
                              </div>
                              <div 
                                className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ 
                                  __html: parseMarkdownToHTML(referenceAnswers[answerKey]) 
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }) : <p className="text-gray-500">No discussion questions available</p>}
                  </div>
                </div>

                {/* Life Application */}
                {studyGuide.lifeApplication && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                      {t('lifeApplication')}
                    </h4>
                    <div className="space-y-4">
                      {studyGuide.lifeApplication.practicalApplications && Array.isArray(studyGuide.lifeApplication.practicalApplications) && studyGuide.lifeApplication.practicalApplications.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('practicalApplications')}</h5>
                          <ul className="list-disc list-inside space-y-2">
                            {studyGuide.lifeApplication.practicalApplications.map((app, i) => (
                              <li key={i} className="text-gray-700">{app}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {studyGuide.lifeApplication.reflectionPoints && Array.isArray(studyGuide.lifeApplication.reflectionPoints) && studyGuide.lifeApplication.reflectionPoints.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('reflectionPoints')}</h5>
                          <ul className="list-disc list-inside space-y-2">
                            {studyGuide.lifeApplication.reflectionPoints.map((point, i) => (
                              <li key={i} className="text-gray-700">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {studyGuide.lifeApplication.actionSteps && Array.isArray(studyGuide.lifeApplication.actionSteps) && studyGuide.lifeApplication.actionSteps.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('actionSteps')}</h5>
                          <ol className="list-decimal list-inside space-y-2">
                            {studyGuide.lifeApplication.actionSteps.map((step, i) => (
                              <li key={i} className="text-gray-700">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Resources */}
                {studyGuide.additionalResources && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                      {t('additionalResources')}
                    </h4>
                    <div className="space-y-4">
                      {studyGuide.additionalResources.crossReferences && Array.isArray(studyGuide.additionalResources.crossReferences) && studyGuide.additionalResources.crossReferences.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('crossReferences')}</h5>
                          <div className="text-gray-700">
                            <BibleReferenceHover language={i18n.language}>
                              {studyGuide.additionalResources.crossReferences.join(' • ')}
                            </BibleReferenceHover>
                          </div>
                        </div>
                      )}
                      {studyGuide.additionalResources.memoryVerses && Array.isArray(studyGuide.additionalResources.memoryVerses) && studyGuide.additionalResources.memoryVerses.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('memoryVerses')}</h5>
                          <p className="text-gray-700">{studyGuide.additionalResources.memoryVerses.join(' • ')}</p>
                        </div>
                      )}
                      {studyGuide.additionalResources.prayerPoints && Array.isArray(studyGuide.additionalResources.prayerPoints) && studyGuide.additionalResources.prayerPoints.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('prayerPoints')}</h5>
                          <ul className="list-disc list-inside space-y-2">
                            {studyGuide.additionalResources.prayerPoints.map((point, i) => (
                              <li key={i} className="text-gray-700">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Commentaries Used */}
                {studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0 && (
                  <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">{t('commentariesUsed')}</h4>
                    <div className="space-y-3">
                      {studyGuide.commentariesUsed.map((commentary, index) => (
                        <div key={index} className="bg-white p-3 rounded border border-gray-200">
                          <p className="text-gray-700">
                            <span className="font-semibold text-indigo-600">{typeof commentary.citation === 'string' ? commentary.citation : `[${index + 1}]`}</span>{' '}
                            <span className="font-medium">{typeof commentary.name === 'string' ? commentary.name : 'Commentary'}</span>{' '}
                            by <span className="italic">{typeof commentary.author === 'string' ? commentary.author : 'Unknown'}</span>
                          </p>
                          {commentary.url && typeof commentary.url === 'string' && (
                            <a href={commentary.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-1 block">
                              View source →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Prompt */}
                <div className="text-center py-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <p className="text-gray-700 mb-3">
                    {t('downloadPrompt')}
                  </p>
                  <button
                    onClick={exportToPDF}
                    className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    {i18n.language === 'zh' ? '导出PDF' : 'Export PDF'}
                  </button>
                </div>

                {/* Footer */}
                <div className="text-center py-4 text-sm text-gray-600">
                  <p>{t('downloadHeaders.generatedBy')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Cross className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('features.theological')}</h3>
            <p className="text-gray-600 text-sm">
              {t('features.theologicalDesc')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Book className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('features.comprehensive')}</h3>
            <p className="text-gray-600 text-sm">
              {t('features.comprehensiveDesc')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Users className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('features.groupReady')}</h3>
            <p className="text-gray-600 text-sm">
              {t('features.groupReadyDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleStudyCreator;