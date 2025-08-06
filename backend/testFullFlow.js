import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommentaryRetriever } from './services/commentaryRetriever.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testFullFlow() {
  console.log('=== Testing Full Commentary Flow ===\n');
  
  console.log('Configuration:');
  console.log('- ScraperAPI:', process.env.SCRAPERAPI_KEY ? '✅ Configured' : '❌ Not configured');
  console.log('- Alternative Sources:', process.env.USE_ALTERNATIVE_SOURCES === 'true' ? '✅ Enabled' : '❌ Disabled');
  console.log('');
  
  const retriever = new CommentaryRetriever();
  
  try {
    console.log('Testing commentary fetch for John 3:16...\n');
    
    const startTime = Date.now();
    const result = await retriever.getCommentariesForDenomination(
      'calvinism',
      'John 3:16',
      2,
      'en'
    );
    const elapsed = Date.now() - startTime;
    
    console.log(`\n✅ Fetch completed in ${elapsed}ms\n`);
    
    if (result.error) {
      console.error('❌ Error:', result.error);
      return;
    }
    
    if (result.commentaries && result.commentaries.length > 0) {
      console.log(`Successfully fetched ${result.commentaries.length} commentaries:\n`);
      
      result.commentaries.forEach((comm, index) => {
        console.log(`${index + 1}. ${comm.name}`);
        console.log(`   Source: ${comm.source || 'StudyLight.org'}`);
        console.log(`   Content length: ${comm.content.length} characters`);
        console.log(`   Success: ${comm.success ? '✅' : '❌'}`);
        
        // Check if it's from alternative source
        if (comm.content.includes('[Alternative Source:')) {
          console.log(`   📍 Using alternative source (StudyLight may be blocked)`);
        }
        
        // Show first 200 chars
        console.log(`   Preview: ${comm.content.substring(0, 200)}...`);
        console.log('');
      });
    } else {
      console.log('⚠️ No commentaries fetched');
    }
    
    if (result.failedCommentaries && result.failedCommentaries.length > 0) {
      console.log('\nFailed commentaries:');
      result.failedCommentaries.forEach(failed => {
        console.log(`  ❌ ${failed.name}: ${failed.error}`);
      });
    }
    
    console.log('\n=== Summary ===');
    console.log('The system is working with the following strategy:');
    console.log('1. Try ScraperAPI first (if configured)');
    console.log('2. Fallback to direct request if ScraperAPI fails');
    console.log('3. Use alternative sources (Bible Hub/Gateway) if StudyLight is blocked');
    console.log('4. Cache successful results to minimize requests');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
  }
}

testFullFlow();