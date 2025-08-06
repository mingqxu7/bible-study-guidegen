# Commentary Source Blocking Mitigation Guide

## Overview
This guide explains how to handle situations where StudyLight.org or other commentary sources block your requests.

## Implemented Protections

### 1. User-Agent Rotation
The system automatically rotates between different browser user agents to appear as different browsers.

### 2. Request Rate Limiting
- Base delay: 1.5 seconds between requests
- Exponential backoff when errors occur
- Random jitter added to delays to avoid pattern detection

### 3. Retry Logic
- Automatic retry with exponential backoff (3 attempts)
- Handles 403 (Forbidden) and 429 (Too Many Requests) responses

### 4. Alternative Sources
When StudyLight.org is blocked, the system automatically falls back to:
- Bible Hub (biblehub.com)
- Bible Gateway (biblegateway.com)

## Configuration Options

### Environment Variables

Add these to your `.env` file:

```bash
# Enable alternative sources by default
USE_ALTERNATIVE_SOURCES=true

# Proxy configuration (optional)
PROXY_HOST=your-proxy-host
PROXY_PORT=your-proxy-port
PROXY_USER=your-username  # Optional
PROXY_PASS=your-password  # Optional

# Or use a proxy service
SCRAPERAPI_KEY=your-scraperapi-key
```

## Using Proxy Services

### Option 1: ScraperAPI (Recommended)
1. Sign up at https://www.scraperapi.com/
2. Get your API key
3. Add to `.env`: `SCRAPERAPI_KEY=your-key`

### Option 2: ProxyMesh
1. Sign up at https://proxymesh.com/
2. Configure proxy settings in `.env`

### Option 3: Bright Data
1. Sign up at https://brightdata.com/
2. Configure proxy settings in `.env`

## Manual Workarounds

### 1. Clear Cache
If you're getting stale or blocked responses:
```javascript
// In your code
commentaryRetriever.clearCache();
```

### 2. Increase Delays
Modify `requestDelay` in `commentaryRetriever.js`:
```javascript
this.requestDelay = 3000; // 3 seconds instead of 1.5
```

### 3. Use VPN
Consider using a VPN service to change your IP address if you're consistently blocked.

## Testing Alternative Sources

You can test the alternative sources directly:

```javascript
import { AlternativeCommentaryFetcher } from './backend/services/alternativeCommentaryFetcher.js';

const fetcher = new AlternativeCommentaryFetcher();
const result = await fetcher.fetchCommentary('john', 3, 16);
console.log(result);
```

## Monitoring

The system logs blocking events. Watch for:
- "Access blocked (403)" messages
- "Blocked count increased to X" warnings
- "Attempting to fetch from alternative sources" info messages

## Best Practices

1. **Don't make too many requests**: Space out your requests
2. **Cache results**: The system caches results automatically
3. **Use alternative sources**: Enable `USE_ALTERNATIVE_SOURCES=true`
4. **Respect rate limits**: Don't try to bypass delays
5. **Consider paid APIs**: For production use, consider official Bible API services

## Troubleshooting

### Still Getting Blocked?

1. Check your IP reputation at https://www.abuseipdb.com/
2. Increase delays between requests
3. Use a proxy service
4. Contact the website owner for API access
5. Consider using official Bible APIs instead

### Alternative Sources Not Working?

1. Check if the alternative sites are accessible
2. Verify the book name mappings in `alternativeCommentaryFetcher.js`
3. Check for changes in the HTML structure of alternative sites

## Legal and Ethical Considerations

- Always respect website terms of service
- Don't overwhelm servers with requests
- Consider reaching out for official API access
- Use caching to minimize requests
- Be a good netizen - these are free resources

## Future Improvements

Consider implementing:
- Distributed request system using multiple IPs
- Official API integrations
- Local commentary database
- Peer-to-peer commentary sharing
- Cached commentary CDN