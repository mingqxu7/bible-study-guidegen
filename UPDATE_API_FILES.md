# Updates Needed for Vercel API Files

The Vercel deployment uses the `/api` directory files, not the backend server. You need to update:

1. `/api/generate-study.js`
2. `/api/generate-study-stream.js`

## Changes to Apply:

### 1. Update MAX_OUTPUT_TOKENS (around line 7-8)
```javascript
const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS) || 24000;
```

### 2. Update the Exegesis Prompt Instructions
Replace the verse-by-verse exegesis instructions with:
```
2. **Verse-by-Verse Exegesis**
   - CRITICAL REQUIREMENT: You MUST provide detailed explanation for EVERY SINGLE VERSE in the passage ${verseInput}
   - If the passage is ${verseInput}, you must include ALL verses from the beginning to the end of that range
   - ABSOLUTELY NO SKIPPING: Cover each verse individually - you MUST provide ${parsedVerse.endVerse ? (parsedVerse.endVerse - parsedVerse.startVerse + 1) : 1} separate explanations
   - Each verse must have its own entry in the exegesis array with verse number, text, and explanation
   - MANDATORY VERSE LIST: You must include these specific verses: ${parsedVerse.endVerse ? Array.from({length: parsedVerse.endVerse - parsedVerse.startVerse + 1}, (_, i) => `${parsedVerse.chapter}:${parsedVerse.startVerse + i}`).join(', ') : `${parsedVerse.chapter}:${parsedVerse.startVerse}`}
   - Base explanations on the provided commentaries
   - CRITICAL CITATION REQUIREMENT: Throughout the explanation text, you MUST include citation numbers [1], [2], [3] when referencing specific commentary insights
   - Simply add the citation number at the end of sentences or phrases that reference commentary insights
   - MANDATORY: Extract insightful verbatim quotes from commentaries for each verse
   - Key Greek/Hebrew word insights where mentioned in commentaries (with citations)
   - Cross-references to related passages
   - Theological insights from the ${selectedStance.name} perspective
```

### 3. Update VERBATIM QUOTE REQUIREMENT section
Add after the IMPORTANT CITATION REQUIREMENT:
```
VERBATIM QUOTE REQUIREMENT: For each verse, you MUST extract at least one insightful verbatim quote from the commentaries. These quotes should:
- Be the most significant and insightful portions of the commentary for that specific verse
- Be extracted exactly as written in the commentary (word-for-word)
- Include proper citation with commentary name and author
- Focus on theological insights, word studies, historical context, or practical applications
- Be substantial enough to provide meaningful insight (at least one complete sentence)
- If multiple commentaries address the same verse, extract quotes from different commentaries to provide diverse perspectives
```

### 4. Update JSON structure for exegesis
In both Chinese and English examples:
```javascript
"exegesis": [
  {
    "verse": "经文章节/Verse reference",
    "text": "经文内容/Verse text",
    "explanation": "基于注释书的详细解释/Detailed explanation based on commentaries",
    "verbatimQuotes": [
      {
        "quote": "逐字引用的注释内容/Exact quote from commentary",
        "commentary": "注释书名称/Commentary name",
        "author": "作者姓名/Author name"
      }
    ],
    "keyInsights": ["要点1/insight1", "要点2/insight2"],
    "crossReferences": ["参考经文1/ref1", "参考经文2/ref2"]
  }
]
```

### 5. Update JSON formatting instructions
Replace the last line with:
```
CRITICAL JSON FORMATTING REQUIREMENTS:
- DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON
- DON'T INCLUDE LEADING BACKTICKS LIKE \`\`\`json
- ESCAPE ALL QUOTATION MARKS: Any quote marks (both English " and Chinese "引号") within JSON string values MUST be escaped with backslashes (\")
- This includes quotes in explanations, verbatim quotes, commentary text, and ALL other string content
- Example: "这里的\\"沉沦\\"不是指" instead of "这里的"沉沦"不是指"
- Make sure the JSON is complete and properly closed with all brackets and braces
- If the response is getting too long, prioritize completing the JSON structure over adding more content
```

## Quick Copy-Paste Commands:

To see the differences:
```bash
diff backend/server.js api/generate-study.js
diff backend/server.js api/generate-study-stream.js
```

## Important Note:
The API files are what Vercel actually uses for deployment, so these must be updated for the verbatim quotes feature to work in production.