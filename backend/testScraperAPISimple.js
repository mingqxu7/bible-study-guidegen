import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testSimpleScraperAPI() {
  console.log('=== Simple ScraperAPI Test ===\n');
  
  if (!process.env.SCRAPERAPI_KEY) {
    console.error('❌ SCRAPERAPI_KEY not found');
    return;
  }
  
  console.log('✅ API Key:', process.env.SCRAPERAPI_KEY.substring(0, 10) + '...');
  
  try {
    // Test 1: Simple website
    console.log('\n1. Testing with simple website (httpbin.org)...');
    const response1 = await axios.get('http://api.scraperapi.com', {
      params: {
        api_key: process.env.SCRAPERAPI_KEY,
        url: 'https://httpbin.org/html'
      },
      timeout: 15000
    });
    console.log('✅ httpbin.org responded:', response1.status);
    console.log('Response length:', response1.data.length, 'characters\n');
    
    // Test 2: StudyLight.org
    console.log('2. Testing with StudyLight.org...');
    const testUrl = 'https://www.studylight.org/commentaries/eng/mhc/john-3.html';
    const response2 = await axios.get('http://api.scraperapi.com', {
      params: {
        api_key: process.env.SCRAPERAPI_KEY,
        url: testUrl,
        render: 'false'
      },
      timeout: 20000
    });
    console.log('✅ StudyLight.org responded:', response2.status);
    console.log('Response length:', response2.data.length, 'characters');
    
    // Check if we got actual content
    if (response2.data.includes('Matthew Henry')) {
      console.log('✅ Content verification: Found "Matthew Henry" in response');
    } else if (response2.data.includes('commentary')) {
      console.log('✅ Content verification: Found "commentary" in response');
    } else {
      console.log('⚠️ Content verification: Expected content not found');
      console.log('First 500 chars:', response2.data.substring(0, 500));
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.error('\nTroubleshooting:');
    console.error('1. Check your API key is correct');
    console.error('2. Verify you have remaining credits at https://dashboard.scraperapi.com/');
    console.error('3. Try the request directly in your browser:');
    console.error(`   http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}&url=https://httpbin.org/html`);
  }
}

testSimpleScraperAPI();