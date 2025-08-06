# Proxy Setup Guide

## Quick Setup Options

### Option 1: ScraperAPI (Easiest - Recommended)

1. **Sign up** at https://www.scraperapi.com/
2. **Get your API key** from dashboard
3. **Add to `.env`:**
   ```bash
   SCRAPERAPI_KEY=your_api_key_here
   ```
4. **That's it!** The system will automatically use ScraperAPI

### Option 2: Smartproxy (Good for high volume)

1. **Sign up** at https://smartproxy.com/
2. **Purchase a plan** (starts at $75/month)
3. **Get credentials** from dashboard
4. **Add to `.env`:**
   ```bash
   PROXY_HOST=gate.smartproxy.com
   PROXY_PORT=10000
   PROXY_USER=your_username
   PROXY_PASS=your_password
   ```

### Option 3: ProxyMesh (Budget-friendly)

1. **Sign up** at https://proxymesh.com/
2. **Choose a plan** (from $10/month)
3. **Get proxy endpoints** from dashboard
4. **Add to `.env`:**
   ```bash
   PROXY_HOST=us-wa.proxymesh.com
   PROXY_PORT=31280
   PROXY_USER=your_username
   PROXY_PASS=your_password
   ```

## Free Alternatives (Use with caution)

### Webshare (Free tier available)
1. **Sign up** at https://www.webshare.io/
2. **Get 10 free proxies**
3. **Download proxy list** from dashboard
4. **Add to `.env`:**
   ```bash
   PROXY_HOST=proxy.webshare.io
   PROXY_PORT=port_from_list
   PROXY_USER=your_username
   PROXY_PASS=your_password
   ```

### ProxyScrape (Free proxy list)
- Visit: https://proxyscrape.com/free-proxy-list
- **Note:** Unreliable, changes frequently, not recommended

## Testing Your Proxy

Create a test file `testProxy.js`:

```javascript
import axios from 'axios';

const testProxy = async () => {
  try {
    const config = {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    // Add proxy if configured
    if (process.env.PROXY_HOST) {
      config.proxy = {
        host: process.env.PROXY_HOST,
        port: parseInt(process.env.PROXY_PORT),
        auth: process.env.PROXY_USER ? {
          username: process.env.PROXY_USER,
          password: process.env.PROXY_PASS
        } : undefined
      };
    }

    // Test by checking IP
    const response = await axios.get('https://api.ipify.org?format=json', config);
    console.log('Your IP through proxy:', response.data.ip);
    
    // Test StudyLight
    const testUrl = 'https://www.studylight.org/commentaries/eng/dsb/john-3.html';
    const studyResponse = await axios.get(testUrl, config);
    console.log('StudyLight test:', studyResponse.status === 200 ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('Proxy test failed:', error.message);
  }
};

testProxy();
```

Run with:
```bash
node testProxy.js
```

## Comparison Table

| Service | Free Tier | Starting Price | Ease of Use | Reliability |
|---------|-----------|----------------|-------------|-------------|
| ScraperAPI | 5,000 req/mo | $49/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| ScrapingBee | 1,000 req/mo | $49/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Smartproxy | No | $75/mo | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| ProxyMesh | No | $10/mo | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Webshare | 10 proxies | $2.99/mo | ⭐⭐⭐ | ⭐⭐⭐ |
| Bright Data | No | $500/mo | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Free Proxies | Yes | Free | ⭐⭐ | ⭐ |

## Which Should You Choose?

### For Testing/Development:
- **ScraperAPI free tier** (5,000 requests/month)
- **Webshare free tier** (10 proxies)

### For Production:
- **Small scale**: ProxyMesh ($10/month)
- **Medium scale**: ScraperAPI or Smartproxy
- **Large scale**: Bright Data

### If You're Blocked RIGHT NOW:
1. **Quickest fix**: Sign up for ScraperAPI (takes 2 minutes)
2. **Free option**: Use Webshare free tier
3. **Temporary**: Use your phone's hotspot to change IP

## Alternative: Run Your Own Proxy

If you have access to a VPS or cloud server:

1. **Set up a VPS** on DigitalOcean, AWS, or Linode
2. **Install Squid proxy:**
   ```bash
   sudo apt-get update
   sudo apt-get install squid
   sudo systemctl start squid
   ```
3. **Configure** in `/etc/squid/squid.conf`
4. **Use in `.env`:**
   ```bash
   PROXY_HOST=your_vps_ip
   PROXY_PORT=3128
   ```

## Troubleshooting

### Proxy not working?
1. Check credentials are correct
2. Verify IP is whitelisted (some services require this)
3. Test with `curl` first:
   ```bash
   curl -x http://proxy:port --proxy-user user:pass https://api.ipify.org
   ```

### Still blocked?
- Try different proxy locations
- Increase delays between requests
- Consider using residential proxies (more expensive but less likely to be blocked)
- Contact the proxy service support

## Legal Notice
Always respect website terms of service and robots.txt. Use proxies responsibly and ethically.