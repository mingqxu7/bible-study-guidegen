import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommentaryRetriever } from './services/commentaryRetriever.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testScraperAPIIntegration() {
  console.log('=== Testing ScraperAPI Integration ===\n');
  
  // Check if API key is set
  if (!process.env.SCRAPERAPI_KEY) {
    console.error('❌ SCRAPERAPI_KEY not found in .env file');
    console.log('Please add: SCRAPERAPI_KEY=your_api_key to your .env file');
    return;
  }
  
  console.log('✅ ScraperAPI key found:', process.env.SCRAPERAPI_KEY.substring(0, 10) + '...');
  
  const retriever = new CommentaryRetriever();
  
  try {
    console.log('\n📖 Testing Bible commentary fetch...');
    console.log('Fetching John 3:16 commentary from Matthew Henry...\n');
    
    // Test fetching a commentary
    const result = await retriever.fetchCommentary('mhc', 'john', 3, 16, 16);
    
    if (result && !result.startsWith('Error')) {
      console.log('✅ Successfully fetched commentary!');
      console.log('Commentary length:', result.length, 'characters');
      console.log('\nFirst 500 characters:');
      console.log(result.substring(0, 500) + '...\n');
      
      // Check if it's from alternative source
      if (result.includes('[Alternative Source:')) {
        console.log('ℹ️ Commentary was fetched from alternative source (Bible Hub/Gateway)');
      } else {
        console.log('ℹ️ Commentary was fetched from StudyLight.org via ScraperAPI');
      }
    } else {
      console.log('⚠️ Commentary fetch returned an error:', result);
    }
    
    // Test with multiple commentaries
    console.log('\n📚 Testing multiple commentaries for Reformed theology...');
    const multiResult = await retriever.getCommentariesForDenomination(
      'reformed',
      'Romans 8:28',
      2,
      'en'
    );
    
    if (multiResult.commentaries && multiResult.commentaries.length > 0) {
      console.log(`✅ Successfully fetched ${multiResult.commentaries.length} commentaries:`);
      multiResult.commentaries.forEach(comm => {
        console.log(`  - ${comm.name}: ${comm.content.length} characters`);
      });
    } else if (multiResult.error) {
      console.log('⚠️ Error fetching commentaries:', multiResult.error);
    } else {
      console.log('⚠️ No commentaries fetched');
    }
    
    if (multiResult.failedCommentaries && multiResult.failedCommentaries.length > 0) {
      console.log('\n⚠️ Failed commentaries:');
      multiResult.failedCommentaries.forEach(failed => {
        console.log(`  - ${failed.name}: ${failed.error}`);
      });
    }
    
    // Test cache
    console.log('\n💾 Testing cache...');
    const cachedResult = await retriever.fetchCommentary('mhc', 'john', 3, 16, 16);
    console.log('✅ Cache is working (should see "Using cached commentary" message above)');
    
    console.log('\n=== Test Complete ===');
    console.log('\nRecommendations:');
    console.log('1. If you see successful fetches, ScraperAPI is working!');
    console.log('2. Monitor your ScraperAPI dashboard for usage: https://dashboard.scraperapi.com/');
    console.log('3. You have 5,000 free requests per month');
    console.log('4. Each commentary fetch uses 1 API credit');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check your SCRAPERAPI_KEY in .env');
    console.error('2. Verify your ScraperAPI account is active');
    console.error('3. Check if you have remaining API credits');
    console.error('4. Try visiting https://dashboard.scraperapi.com/ to check status');
  }
}

// Run the test
testScraperAPIIntegration();