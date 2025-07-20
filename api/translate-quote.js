import Anthropic from '@anthropic-ai/sdk';

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS) || 2000;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
      quote, 
      commentary, 
      author,
      passage,
      theology
    } = req.body;

    if (!quote) {
      return res.status(400).json({ 
        error: '缺少必需的参数' 
      });
    }


    const translationPrompt = `请将以下英文圣经注释引用翻译成简体中文。

**原文引用:**
"${quote}"

**注释书信息:**
注释书: ${commentary}
作者: ${author}
经文: ${passage}
神学立场: ${theology}

**翻译要求:**
1. 保持原文的神学准确性和深度
2. 使用标准的中文圣经神学术语
3. 确保翻译自然流畅，符合中文表达习惯
4. 保留原文的语气和强调重点
5. 如果涉及希腊文或希伯来文词汇，请提供音译和解释
6. 保持注释的学术性和牧养性质

请只返回翻译后的中文文本，不要包含其他说明。`;

    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: translationPrompt }],
    });

    const translation = message.content[0]?.text || '';

    if (!translation) {
      return res.status(500).json({ 
        error: '翻译失败' 
      });
    }

    res.json({ 
      translation: translation.trim(),
      originalQuote: quote,
      commentary,
      author
    });

  } catch (error) {
    console.error('Error translating quote:', error);
    
    let errorMessage = '翻译失败，请重试';
    
    if (error.status === 429) {
      errorMessage = 'API请求过于频繁，请稍后重试';
    } else if (error.status === 401) {
      errorMessage = 'API密钥无效';
    }

    res.status(500).json({ error: errorMessage });
  }
}