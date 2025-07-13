import Anthropic from '@anthropic-ai/sdk';
import { CommentaryRetriever } from '../backend/services/commentaryRetriever.js';
import { getCommentaryUrl } from '../backend/services/commentaryMapping.js';

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS) || 8192;
const MAX_COMMENTARIES = parseInt(process.env.MAX_COMMENTARIES) || 2;
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
    const { verseInput, selectedTheology, theologicalStances, language = 'en' } = req.query;
    const parsedTheologicalStances = JSON.parse(theologicalStances || '[]');

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
      res.write(`data: ${JSON.stringify({ 
        type: 'progress', 
        step: 'parsed', 
        message: language === 'zh' ? `已解析经文：${parsedVerse.bookName} ${parsedVerse.chapter}:${parsedVerse.startVerse}${parsedVerse.endVerse ? '-' + parsedVerse.endVerse : ''}` : `Parsed: ${parsedVerse.bookName} ${parsedVerse.chapter}:${parsedVerse.startVerse}${parsedVerse.endVerse ? '-' + parsedVerse.endVerse : ''}`
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
        language
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

    // Create prompt (same as original but simplified for brevity)
    const isChinese = language === 'zh' || language === 'zh-CN' || language.startsWith('zh');
    const languageInstructions = isChinese 
      ? `CRITICAL LANGUAGE REQUIREMENT: You MUST generate the ENTIRE study guide in Simplified Chinese (简体中文). ALL content must be in Chinese. Do NOT mix English and Chinese. The ONLY English allowed is author names and commentary titles in citations.`
      : 'IMPORTANT LANGUAGE REQUIREMENT: Generate the entire study guide in English.';
    
    const prompt = `Create a comprehensive Bible study guide for cell group leaders based on the following:

${languageInstructions}

PASSAGE: ${verseInput}
THEOLOGICAL PERSPECTIVE: ${selectedStance.name} - ${selectedStance.description}

COMMENTARY SOURCES:
${commentariesText}

Using the above commentaries as your primary source material, create a detailed study guide with verse-by-verse exegesis, discussion questions, life applications, and additional resources. Include a "commentariesUsed" section with citation numbers [1], [2], etc.

Respond with a well-structured JSON object with the required format. DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

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