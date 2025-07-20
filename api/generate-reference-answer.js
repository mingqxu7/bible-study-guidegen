import Anthropic from '@anthropic-ai/sdk';

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS) || 4000;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      question, 
      passage, 
      verseText,
      theology, 
      commentary, 
      language = 'en',
      exegesis 
    } = req.body;

    if (!question || !passage) {
      return res.status(400).json({ 
        error: language === 'zh' ? '缺少必需的参数' : 'Missing required parameters' 
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build context for the LLM
    let contextPrompt = '';
    
    if (language === 'zh') {
      contextPrompt = `作为圣经学者和牧师，请为以下讨论问题提供一个深思熟虑、符合圣经的参考答案。

**经文背景:**
经文: ${passage}
${verseText ? `经文内容: "${verseText}"` : ''}

**神学立场:** ${theology}

${exegesis ? `**解经背景:**
${exegesis}` : ''}

${commentary ? `**注释书见解:**
${commentary}` : ''}

**讨论问题:**
${question}

请提供一个包含以下要素的参考答案：
1. 直接回答问题的核心观点
2. 相关的圣经经文引用来支持答案
3. 从${theology}神学立场的角度进行阐释
4. 实际的生活应用建议
5. 进一步思考的方向

答案应该：
- 基于圣经权威
- 符合${theology}的神学框架
- 实用且适合小组讨论
- 长度适中（200-400字）
- 鼓励进一步的思考和讨论

请用中文回答。`;
    } else {
      contextPrompt = `As a biblical scholar and pastor, please provide a thoughtful, biblically-grounded reference answer to the following discussion question.

**Scripture Context:**
Passage: ${passage}
${verseText ? `Verse Text: "${verseText}"` : ''}

**Theological Perspective:** ${theology}

${exegesis ? `**Exegetical Background:**
${exegesis}` : ''}

${commentary ? `**Commentary Insights:**
${commentary}` : ''}

**Discussion Question:**
${question}

Please provide a reference answer that includes:
1. A direct response to the core question
2. Relevant biblical cross-references to support the answer
3. Interpretation from the ${theology} theological perspective
4. Practical life application suggestions
5. Directions for further reflection

The answer should be:
- Grounded in biblical authority
- Consistent with ${theology} theological framework
- Practical and suitable for group discussion
- Moderate length (200-400 words)
- Encouraging of further thought and discussion

Please respond in English.`;
    }

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: contextPrompt }],
    });

    const referenceAnswer = message.content[0]?.text || '';

    if (!referenceAnswer) {
      return res.status(500).json({ 
        error: language === 'zh' ? '生成参考答案失败' : 'Failed to generate reference answer' 
      });
    }

    res.json({ 
      referenceAnswer,
      question,
      passage,
      theology
    });

  } catch (error) {
    console.error('Error generating reference answer:', error);
    
    let errorMessage = 'Failed to generate reference answer';
    if (req.body?.language === 'zh') {
      errorMessage = '生成参考答案失败，请重试';
    }
    
    if (error.status === 429) {
      errorMessage = req.body?.language === 'zh' 
        ? 'API请求过于频繁，请稍后重试' 
        : 'Rate limit exceeded. Please try again later.';
    } else if (error.status === 401) {
      errorMessage = req.body?.language === 'zh' 
        ? 'API密钥无效' 
        : 'Invalid API key';
    }

    res.status(500).json({ error: errorMessage });
  }
}