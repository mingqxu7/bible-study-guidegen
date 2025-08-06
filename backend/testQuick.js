import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommentaryRetriever } from './services/commentaryRetriever.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function quickTest() {
  console.log('=== Quick Commentary Test ===');
  
  const retriever = new CommentaryRetriever();
  
  try {
    // Test one quick commentary
    const result = await retriever.fetchCommentary('cal', 'john', 3, 16, 16);
    
    if (result.includes('[Alternative Source:')) {
      console.log('✅ Alternative sources working');
    } else if (result.length > 1000) {
      console.log('✅ StudyLight working normally');
    } else {
      console.log('⚠️ Limited content received');
    }
    
    console.log('Result length:', result.length);
    console.log('First 200 chars:', result.substring(0, 200));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();