import Anthropic from '@anthropic-ai/sdk';
import { CommentaryRetriever } from '../backend/services/commentaryRetriever.js';
import { getCommentaryUrl } from '../backend/services/commentaryMapping.js';

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS) || 8192;
const MAX_COMMENTARIES = parseInt(process.env.MAX_COMMENTARIES) || 3;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const commentaryRetriever = new CommentaryRetriever();

export default async function handler(req, res) {
  // Enable CORS for SSE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { verseInput, selectedTheology, theologicalStances, language = 'en', selectedCommentaries } = req.query;
    const parsedTheologicalStances = JSON.parse(theologicalStances || '[]');
    const parsedSelectedCommentaries = selectedCommentaries ? JSON.parse(selectedCommentaries) : null;

    if (!verseInput || !selectedTheology) {
      res.write(`data: ${JSON.stringify({ error: 'Please provide both verse input and theological stance.' })}\n\n`);
      res.end();
      return;
    }

    const selectedStance = parsedTheologicalStances.find(t => t.id === selectedTheology);
    
    if (!selectedStance) {
      res.write(`data: ${JSON.stringify({ error: 'Invalid theological stance selected.' })}\n\n`);
      res.end();
      return;
    }

    console.log(`Generating study guide for ${verseInput} with ${selectedStance.name} perspective in ${language} language`);
    
    // Send initial progress
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      step: 'parsing', 
      message: language === 'zh' ? '正在解析经文引用...' : 'Parsing verse reference...' 
    })}\n\n`);

    // Step 1: Parse and validate verse reference
    let parsedVerse;
    try {
      parsedVerse = commentaryRetriever.parseVerseReference(verseInput, language);
      
      // Calculate the total number of verses in the range
      const totalVerses = parsedVerse.endVerse ? (parsedVerse.endVerse - parsedVerse.startVerse + 1) : 1;
      
      res.write(`data: ${JSON.stringify({ 
        type: 'progress', 
        step: 'parsed', 
        message: language === 'zh' ? `已解析经文：${parsedVerse.bookName} ${parsedVerse.chapter}:${parsedVerse.startVerse}${parsedVerse.endVerse ? '-' + parsedVerse.endVerse : ''} (共${totalVerses}节)` : `Parsed: ${parsedVerse.bookName} ${parsedVerse.chapter}:${parsedVerse.startVerse}${parsedVerse.endVerse ? '-' + parsedVerse.endVerse : ''} (${totalVerses} verses total)`
      })}\n\n`);
    } catch (parseError) {
      res.write(`data: ${JSON.stringify({ error: parseError.message })}\n\n`);
      res.end();
      return;
    }

    // Step 2: Retrieve commentaries
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      step: 'retrieving_commentaries', 
      message: language === 'zh' ? '正在从 StudyLight.org 检索注释书...' : 'Retrieving commentaries from StudyLight.org...'
    })}\n\n`);
    
    let commentaryData;
    let usableCommentaries = [];
    try {
      console.log('Retrieving commentaries...');
      
      // Add timeout for Vercel (10 seconds max)
      const commentaryPromise = commentaryRetriever.getCommentariesForDenomination(
        selectedTheology, 
        verseInput,
        MAX_COMMENTARIES,
        language,
        parsedSelectedCommentaries
      );
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Commentary retrieval timeout')), 10000)
      );
      
      commentaryData = await Promise.race([commentaryPromise, timeoutPromise]);
      
      const successfulCount = commentaryData.commentaries.length;
      const failedCount = commentaryData.failedCommentaries?.length || 0;
      
      console.log(`Successfully retrieved ${successfulCount} commentaries`);
      
      // Send progress update with commentary details
      res.write(`data: ${JSON.stringify({ 
        type: 'progress', 
        step: 'commentaries_retrieved', 
        message: language === 'zh' ? `已检索到 ${successfulCount} 本注释书${failedCount > 0 ? `，${failedCount} 本失败` : ''}` : `Retrieved ${successfulCount} commentaries${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        details: {
          successful: commentaryData.commentaries.map(c => ({ name: c.name, author: c.author })),
          failed: failedCount > 0 ? commentaryData.failedCommentaries.map(c => c.name) : []
        }
      })}\n\n`);
      
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
      
      // For validation errors, return to user
      if (commentaryError.message.includes('Please specify verses') || 
          commentaryError.message.includes('Please specify chapter') ||
          commentaryError.message.includes('Invalid verse format') ||
          commentaryError.message.includes('Unknown book') ||
          commentaryError.message.includes('请指定经文') ||
          commentaryError.message.includes('请指定章节') ||
          commentaryError.message.includes('经文格式无效') ||
          commentaryError.message.includes('未知的书卷')) {
        res.write(`data: ${JSON.stringify({ error: commentaryError.message })}\n\n`);
        res.end();
        return;
      }
      
      // Use fallback for other errors
      commentaryData = {
        denomination: selectedTheology,
        passage: verseInput,
        commentaries: [{
          name: 'General Biblical Knowledge',
          author: 'System',
          content: `Commentary retrieval ${commentaryError.message.includes('timeout') ? 'timed out' : 'failed'}. Using general theological knowledge from ${selectedStance.name} perspective.`,
          source: 'System'
        }],
        failedCommentaries: []
      };
    }

    // Step 3: Filter commentaries
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      step: 'filtering_commentaries', 
      message: language === 'zh' ? '正在筛选可用的注释内容...' : 'Filtering available commentary content...'
    })}\n\n`);
    
    usableCommentaries = commentaryData.commentaries.filter(commentary => {
      return !commentary.content.startsWith('No commentary available for verses');
    });
    
    console.log(`Filtered commentaries: ${usableCommentaries.length} out of ${commentaryData.commentaries.length} have content for requested verses`);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      step: 'commentaries_filtered', 
      message: language === 'zh' ? `找到 ${usableCommentaries.length} 本包含所请求经文内容的注释书` : `Found ${usableCommentaries.length} commentaries with content for requested verses`,
      details: {
        usable: usableCommentaries.map(c => c.name)
      }
    })}\n\n`);
    
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

    // Create complete prompt with full specifications
    const isChinese = language === 'zh' || language === 'zh-CN' || language.startsWith('zh');
    const languageInstructions = isChinese 
      ? `CRITICAL LANGUAGE REQUIREMENT: 
         You MUST generate the ENTIRE study guide in Simplified Chinese (简体中文).
         - ALL content must be in Chinese, including:
           - Title (标题)
           - Overview sections (概览部分)
           - Verse explanations (经文解释)
           - Discussion questions (讨论问题)
           - Life applications (生活应用)
           - ALL other text
         - Do NOT mix English and Chinese
         - Even when citing English commentaries, translate the insights into Chinese
         - The ONLY English allowed is author names and commentary titles in citations
         
         ABSOLUTELY NO ENGLISH TEXT IN THE CONTENT - EVERYTHING MUST BE CHINESE!`
      : 'IMPORTANT LANGUAGE REQUIREMENT: Generate the entire study guide in English.';
    
    const prompt = `Create a comprehensive Bible study guide for cell group leaders based on the following:

${languageInstructions}

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
   - CRITICAL REQUIREMENT: You MUST provide detailed explanation for EVERY SINGLE VERSE in the passage ${verseInput}
   - If the passage is ${verseInput}, you must include ALL verses from the beginning to the end of that range
   - ABSOLUTELY NO SKIPPING: Cover each verse individually - you MUST provide ${parsedVerse.endVerse ? (parsedVerse.endVerse - parsedVerse.startVerse + 1) : 1} separate explanations
   - Each verse must have its own entry in the exegesis array with verse number, text, and explanation
   - MANDATORY VERSE LIST: You must include these specific verses: ${parsedVerse.endVerse ? Array.from({length: parsedVerse.endVerse - parsedVerse.startVerse + 1}, (_, i) => `${parsedVerse.chapter}:${parsedVerse.startVerse + i}`).join(', ') : `${parsedVerse.chapter}:${parsedVerse.startVerse}`}
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

CRITICAL REQUIREMENT FOR VERSE COVERAGE:
- Your exegesis array MUST include an entry for EVERY SINGLE VERSE in the passage ${verseInput}
- Do not omit ANY verses from the specified range
- If the passage is ${verseInput}, you must cover EVERY verse from the beginning to the end of that range
- Count the verses carefully and ensure your exegesis array has exactly ${parsedVerse.endVerse ? (parsedVerse.endVerse - parsedVerse.startVerse + 1) : 1} entries
- MANDATORY: Include these specific verses: ${parsedVerse.endVerse ? Array.from({length: parsedVerse.endVerse - parsedVerse.startVerse + 1}, (_, i) => `${parsedVerse.chapter}:${parsedVerse.startVerse + i}`).join(', ') : `${parsedVerse.chapter}:${parsedVerse.startVerse}`}
- Your exegesis array length MUST equal ${parsedVerse.endVerse ? (parsedVerse.endVerse - parsedVerse.startVerse + 1) : 1}
- FAILURE TO INCLUDE ALL VERSES IS UNACCEPTABLE

Respond with a well-structured JSON object in this format:
${isChinese ? `{
  "title": "学习标题（中文）",
  "passage": "${verseInput}",
  "theology": "${selectedStance.name}",
  "overview": {
    "introduction": "简要介绍（中文）",
    "historicalContext": "历史背景（中文）",
    "literaryContext": "文学背景（中文）"
  },
  "exegesis": [
    {
      "verse": "经文章节",
      "text": "经文内容（中文）",
      "explanation": "基于注释书的详细解释（中文）",
      "keyInsights": ["要点1（中文）", "要点2（中文）"],
      "crossReferences": ["参考经文1", "参考经文2"]
    }
  ],
  "discussionQuestions": [
    "讨论问题1（中文）",
    "讨论问题2（中文）"
  ],
  "lifeApplication": {
    "practicalApplications": ["实际应用1（中文）", "实际应用2（中文）"],
    "reflectionPoints": ["反思要点1（中文）", "反思要点2（中文）"],
    "actionSteps": ["行动步骤1（中文）", "行动步骤2（中文）"]
  },
  "additionalResources": {
    "crossReferences": ["参考经文1", "参考经文2"],
    "memoryVerses": ["背诵经文1", "背诵经文2"],
    "prayerPoints": ["祷告要点1（中文）", "祷告要点2（中文）"]
  },
  "commentariesUsed": [
    {
      "citation": "[1]",
      "name": "Commentary name",
      "author": "Author name",
      "url": "https://www.studylight.org/commentaries/eng/code/book-chapter.html"
    }
  ]
}` : `{
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
}`}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON. DON'T INCLUDE LEADING BACKTICKS LIKE \`\`\`json.`;

    // Step 4: Generate with Claude
    res.write(`data: ${JSON.stringify({ 
      type: 'progress', 
      step: 'generating_guide', 
      message: language === 'zh' ? '正在使用 Claude AI 生成学习指南...' : 'Generating study guide with Claude AI...'
    })}\n\n`);
    
    console.log('Generating study guide with Claude...');
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const studyData = JSON.parse(response.content[0].text);
    
    // Add commentary metadata
    if (!studyData.commentariesUsed) {
      studyData.commentariesUsed = usableCommentaries.map((c, index) => ({
        citation: `[${index + 1}]`,
        name: c.name,
        author: c.author,
        source: c.source || `StudyLight.org - ${c.name}`,
        url: c.url || (c.code ? getCommentaryUrl(c.code, commentaryData.parsedVerse?.book, commentaryData.parsedVerse?.chapter) : null)
      }));
    }

    studyData.commentariesUsed = studyData.commentariesUsed.map((commentary, index) => {
      if (!commentary.url && usableCommentaries[index]) {
        commentary.url = usableCommentaries[index].url || (usableCommentaries[index].code 
          ? getCommentaryUrl(usableCommentaries[index].code, commentaryData.parsedVerse?.book, commentaryData.parsedVerse?.chapter) 
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
    
    // Send final success with study data
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      data: studyData,
      message: language === 'zh' ? '学习指南生成成功！' : 'Study guide generated successfully!'
    })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in SSE endpoint:', error);
    
    let errorMessage = 'Failed to generate study guide. Please try again.';
    if (error.name === 'SyntaxError') {
      errorMessage = 'Failed to parse study guide response. Please try again.';
    } else if (error.status === 401) {
      errorMessage = 'Invalid API key. Please check your Anthropic API configuration.';
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    }
    
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
}