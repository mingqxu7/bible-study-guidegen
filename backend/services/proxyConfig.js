// Proxy configuration for avoiding blocks
export const proxyConfig = {
  // Free proxy rotation (use with caution, these are examples)
  freeProxies: [
    // Note: Free proxies are unreliable. Consider using a paid proxy service
    // Examples (may not work):
    // { host: 'proxy1.example.com', port: 8080 },
    // { host: 'proxy2.example.com', port: 3128 },
  ],
  
  // Paid proxy services (recommended)
  // Configure these in your .env file:
  // PROXY_HOST=your-proxy-host
  // PROXY_PORT=your-proxy-port
  // PROXY_USER=your-username (optional)
  // PROXY_PASS=your-password (optional)
  
  // Alternative: Use proxy services like:
  // - ScraperAPI: https://www.scraperapi.com/
  // - ProxyMesh: https://proxymesh.com/
  // - Bright Data (formerly Luminati): https://brightdata.com/
  // - Oxylabs: https://oxylabs.io/
  
  getProxyUrl: () => {
    if (process.env.SCRAPERAPI_KEY) {
      // ScraperAPI integration
      return `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}&url=`;
    }
    
    if (process.env.PROXY_URL) {
      // Custom proxy URL
      return process.env.PROXY_URL;
    }
    
    return null;
  },
  
  // Headers to use with proxy requests
  getProxyHeaders: () => {
    return {
      'X-Forwarded-For': generateRandomIP(),
      'X-Real-IP': generateRandomIP(),
      'X-Originating-IP': generateRandomIP(),
    };
  }
};

// Generate random IP for headers (use responsibly)
function generateRandomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Alternative commentary sources
export const alternativeSources = {
  // Bible Gateway (has rate limits but generally more lenient)
  bibleGateway: {
    baseUrl: 'https://www.biblegateway.com/resources/commentaries/',
    available: [
      'ivp-nt', // IVP New Testament Commentary
      'mhc', // Matthew Henry's Commentary
    ]
  },
  
  // Bible Hub (good alternative)
  bibleHub: {
    baseUrl: 'https://biblehub.com/commentaries/',
    available: [
      'barnes', // Barnes' Notes
      'clarke', // Clarke's Commentary
      'gill', // Gill's Exposition
      'henry', // Matthew Henry
      'jfb', // Jamieson-Fausset-Brown
      'calvin', // Calvin's Commentary
      'luther', // Luther's Commentary
    ]
  },
  
  // Blue Letter Bible
  blueLetterBible: {
    baseUrl: 'https://www.blueletterbible.org/Comm/',
    available: [
      'guzik', // David Guzik's Commentary
      'mhc', // Matthew Henry's Concise
      'wesley', // Wesley's Notes
    ]
  },
  
  // Precept Austin (requires different parsing)
  preceptAustin: {
    baseUrl: 'https://www.preceptaustin.org/',
    note: 'Requires custom parser'
  }
};

// Function to get alternative URL when StudyLight is blocked
export function getAlternativeCommentaryUrl(book, chapter, source = 'bibleHub') {
  const sources = {
    bibleHub: (book, chapter) => {
      // Convert book name to BibleHub format
      const bookMap = {
        'genesis': 'genesis',
        'matthew': 'matthew',
        'john': 'john',
        // Add more mappings as needed
      };
      return `https://biblehub.com/commentaries/${bookMap[book.toLowerCase()]}/${chapter}.htm`;
    },
    bibleGateway: (book, chapter) => {
      return `https://www.biblegateway.com/passage/?search=${book}+${chapter}&version=ESV`;
    }
  };
  
  return sources[source]?.(book, chapter) || null;
}