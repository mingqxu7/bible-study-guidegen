import Anthropic from '@anthropic-ai/sdk';
import { CommentaryRetriever } from '../backend/services/commentaryRetriever.js';
import { getCommentaryUrl } from '../backend/services/commentaryMapping.js';

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS) || 16000;
const MAX_COMMENTARIES = parseInt(process.env.MAX_COMMENTARIES) || 3;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const commentaryRetriever = new CommentaryRetriever();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { verseInput, selectedTheology, theologicalStances } = req.body;

    if (!verseInput || !selectedTheology) {
      return res.status(400).json({ 
        error: 'Please provide both verse input and theological stance.' 
      });
    }

    const selectedStance = theologicalStances.find(t => t.id === selectedTheology);
    
    if (!selectedStance) {
      return res.status(400).json({ 
        error: 'Invalid theological stance selected.' 
      });
    }

    console.log(`Generating study guide for ${verseInput} with ${selectedStance.name} perspective`);

    // Step 1: Retrieve commentaries from StudyLight.org
    let commentaryData;
    let usableCommentaries = [];
    try {
      console.log('Retrieving commentaries...');
      commentaryData = await commentaryRetriever.getCommentariesForDenomination(
        selectedTheology, 
        verseInput,
        MAX_COMMENTARIES
      );
      
      const successfulCount = commentaryData.commentaries.length;
      const failedCount = commentaryData.failedCommentaries?.length || 0;
      
      console.log(`Successfully retrieved ${successfulCount} commentaries`);
      if (failedCount > 0) {
        console.log(`Filtered out ${failedCount} failed commentaries`);
      }
      
      // If no commentaries were successfully retrieved, use fallback
      if (successfulCount === 0) {
        console.warn('No commentaries successfully retrieved, using fallback');
        commentaryData.commentaries = [{
          name: 'Default Commentary',
          author: 'System',
          content: 'Commentary retrieval failed. Using general theological knowledge.',
          source: 'System'
        }];
      }
    } catch (commentaryError) {
      console.error('Error retrieving commentaries:', commentaryError);
      commentaryData = {
        denomination: selectedTheology,
        passage: verseInput,
        commentaries: [{
          name: 'Default Commentary',
          author: 'System',
          content: 'Commentary retrieval failed. Using general theological knowledge.',
          source: 'System'
        }],
        failedCommentaries: []
      };
    }

    // Step 2: Filter out commentaries with no available verses and format for prompt
    usableCommentaries = commentaryData.commentaries.filter(commentary => {
      return !commentary.content.startsWith('No commentary available for verses');
    });
    
    console.log(`Filtered commentaries: ${usableCommentaries.length} out of ${commentaryData.commentaries.length} have content for requested verses`);
    
    // If no usable commentaries, add a fallback
    if (usableCommentaries.length === 0) {
      console.warn('No commentaries have content for requested verses, using general theological knowledge');
      usableCommentaries.push({
        name: 'General Theological Knowledge',
        author: 'System',
        content: 'No specific commentary available for these verses. Use general biblical and theological knowledge.',
        source: 'System'
      });
    }
    
    // Format commentaries with citation numbers
    const commentariesText = usableCommentaries
      .map((commentary, index) => `
[${index + 1}] **${commentary.name} by ${commentary.author}:**
${commentary.content}
---`)
      .join('\n');

    // Step 3: Create enhanced prompt with commentary content
    const prompt = `Create a comprehensive Bible study guide for cell group leaders based on the following:

PASSAGE: ${verseInput}
THEOLOGICAL PERSPECTIVE: ${selectedStance.name} - ${selectedStance.description}

COMMENTARY SOURCES:
${commentariesText}

IMPORTANT CITATION REQUIREMENT: When using information from the commentaries above, you MUST cite them using the numbers in brackets [1], [2], [3], etc. Every claim, interpretation, or insight drawn from a commentary must include its citation number.

Using the above commentaries as your primary source material, create a detailed study guide that includes:

1. **Passage Overview**
   - Brief introduction to the passage
   - Historical and cultural context
   - Literary context within the book

2. **Verse-by-Verse Exegesis**
   - IMPORTANT: You must provide detailed explanation for EVERY SINGLE VERSE in the passage ${verseInput}
   - Do not skip any verses - cover the complete range from start to end
   - Base explanations on the provided commentaries WITH CITATIONS [1], [2], etc.
   - Include citation numbers when referencing commentary insights
   - Key Greek/Hebrew word insights where mentioned in commentaries (with citations)
   - Cross-references to related passages
   - Theological insights from the ${selectedStance.name} perspective

3. **Discussion Questions** (5-7 thought-provoking questions)
   - Questions that encourage deep reflection
   - Questions that connect to modern life
   - Questions suitable for group discussion

4. **Life Application**
   - Practical ways to apply the passage
   - Personal reflection points
   - Action steps for the week

5. **Additional Resources**
   - Suggested cross-references
   - Memory verses
   - Prayer points

Base your study guide primarily on the commentary content provided above. Draw insights, explanations, and theological perspectives directly from these sources WITH PROPER CITATIONS. When you use information from a specific commentary, include the citation number [1], [2], etc. Format this as a complete study guide that a cell group leader can use immediately.

IMPORTANT: You must include a "commentariesUsed" section in your JSON response that lists all the commentaries you cited, with their citation numbers, names, and authors.

CRITICAL REQUIREMENT: Your exegesis array must include an entry for EVERY SINGLE VERSE in the passage ${verseInput}. Do not omit any verses from the specified range. If the passage is ${verseInput}, then you must cover every verse from the beginning to the end of that range.

Respond with a well-structured JSON object in this format:
{
  "title": "Study title",
  "passage": "${verseInput}",
  "theology": "${selectedStance.name}",
  "overview": {
    "introduction": "Brief introduction",
    "historicalContext": "Historical context",
    "literaryContext": "Literary context"
  },
  "exegesis": [
    {
      "verse": "Verse reference",
      "text": "Verse text",
      "explanation": "Detailed explanation based on commentaries",
      "keyInsights": ["insight1", "insight2"],
      "crossReferences": ["ref1", "ref2"]
    }
  ],
  "discussionQuestions": [
    "Question 1",
    "Question 2"
  ],
  "lifeApplication": {
    "practicalApplications": ["app1", "app2"],
    "reflectionPoints": ["point1", "point2"],
    "actionSteps": ["step1", "step2"]
  },
  "additionalResources": {
    "crossReferences": ["ref1", "ref2"],
    "memoryVerses": ["verse1", "verse2"],
    "prayerPoints": ["point1", "point2"]
  },
  "commentariesUsed": [
    {
      "citation": "[1]",
      "name": "Commentary name",
      "author": "Author name",
      "url": "https://www.studylight.org/commentaries/eng/code/book-chapter.html"
    }
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON. DON'T INCLUDE LEADING BACKTICKS LIKE \`\`\`json.`;

    // Step 4: Generate study guide with Claude
    console.log('Generating study guide with Claude...');
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const studyData = JSON.parse(response.content[0].text);
    
    // If Claude didn't include commentariesUsed, add it based on what we provided
    if (!studyData.commentariesUsed) {
      studyData.commentariesUsed = usableCommentaries.map((c, index) => ({
        citation: `[${index + 1}]`,
        name: c.name,
        author: c.author,
        source: c.source || `StudyLight.org - ${c.name}`,
        url: c.url || (c.code ? getCommentaryUrl(c.code, commentaryData.parsedVerse.book, commentaryData.parsedVerse.chapter) : null)
      }));
    }

    studyData.commentariesUsed = studyData.commentariesUsed.map((commentary, index) => {
      if (!commentary.url && usableCommentaries[index]) {
        commentary.url = usableCommentaries[index].url || (usableCommentaries[index].code 
          ? getCommentaryUrl(usableCommentaries[index].code, commentaryData.parsedVerse.book, commentaryData.parsedVerse.chapter) 
          : null);
      }
      return commentary;
    });
    
    // Add metadata about all commentary sources attempted
    studyData.allCommentarySources = commentaryData.commentaries.map(c => ({
      name: c.name,
      author: c.author,
      source: c.source,
      available: !c.content.startsWith('No commentary available for verses')
    }));
    
    // Add information about failed commentaries if any
    if (commentaryData.failedCommentaries && commentaryData.failedCommentaries.length > 0) {
      studyData.filteredCommentaries = commentaryData.failedCommentaries.map(c => ({
        name: c.name,
        author: c.author,
        reason: 'Failed to retrieve due to timeout or connection error'
      }));
    }
    
    console.log('Study guide generated successfully');
    res.json(studyData);

  } catch (error) {
    console.error('Error generating study guide:', error);
    
    if (error.name === 'SyntaxError') {
      res.status(500).json({ 
        error: 'Failed to parse study guide response. Please try again.' 
      });
    } else if (error.status === 401) {
      res.status(401).json({ 
        error: 'Invalid API key. Please check your Anthropic API configuration.' 
      });
    } else if (error.status === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to generate study guide. Please try again.' 
      });
    }
  }
}