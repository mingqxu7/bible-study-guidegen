import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Define translations inline for better compatibility
const resources = {
  en: {
    translation: {
      "title": "Bible Study Guide Generator",
      "subtitle": "Generate comprehensive, theologically-informed Bible study guides for your cell group ministry",
      "studyConfig": "Study Configuration",
      "selectTheology": "Select Your Theological Perspective:",
      "biblePassage": "Bible Passage:",
      "passagePlaceholder": "e.g., Heb 6:4-6, Matthew 5:1-12, John 3:16, Romans 8:28-39",
      "passageHint": "Enter the passage you want to study (book, chapter, and verses)",
      "generate": "Generate Study Guide",
      "generating": "Generating Study Guide...",
      "studyGuide": "Study Guide",
      "download": "Download",
      "configurePrompt": "Configure your study settings and generate a comprehensive Bible study guide",
      "perspective": "Perspective",
      "overview": "Overview",
      "introduction": "Introduction:",
      "historicalContext": "Historical Context:",
      "literaryContext": "Literary Context:",
      "exegesis": "Verse-by-Verse Exegesis",
      "discussionQuestions": "Discussion Questions",
      "commentariesUsed": "Commentaries Used",
      "downloadPrompt": "Export the complete study guide as a PDF document",
      "features": {
        "theological": "Theologically Aligned",
        "theologicalDesc": "Choose from major theological perspectives to ensure your study guide aligns with your church's beliefs",
        "comprehensive": "Comprehensive Analysis",
        "comprehensiveDesc": "Verse-by-verse exegesis drawing from respected commentaries and biblical scholarship",
        "groupReady": "Group-Ready",
        "groupReadyDesc": "Thought-provoking questions and practical applications designed for cell group discussions"
      },
      "errors": {
        "selectBoth": "Please select a theological stance and enter Bible verses.",
        "specifyVerses": "Please specify verses, not just chapter.",
        "specifyChapter": "Please specify chapter and verses, not just the book.",
        "invalidFormat": "Invalid verse format.",
        "unknownBook": "Unknown book name.",
        "tooManyVerses": "Too many verses selected. Please select fewer verses.",
        "serverError": "Failed to generate study guide. Please try again."
      },
      "theology": {
        "calvinism": {
          "name": "Reformed/Calvinist",
          "description": "Emphasizes God's sovereignty, predestination, and the doctrines of grace"
        },
        "arminianism": {
          "name": "Arminian/Wesleyan", 
          "description": "Emphasizes free will, conditional election, and the possibility of falling from grace"
        },
        "dispensationalism": {
          "name": "Dispensationalist",
          "description": "Emphasizes distinct dispensations and literal interpretation of prophecy"
        },
        "lutheranism": {
          "name": "Lutheran",
          "description": "Emphasizes justification by faith alone and sacramental theology"
        },
        "catholicism": {
          "name": "Catholic",
          "description": "Emphasizes church tradition, papal authority, and sacramental life"
        }
      },
      "andMore": "And {{count}} more...",
      "moreVerses": "And {{count}} more verses...",
      "moreQuestions": "And {{count}} more questions...",
      "commentariesLabel": "Commentaries:",
      "selectCommentaries": "Select commentaries",
      "hideCommentaries": "Hide commentaries",
      "selectUpTo": "Select up to",
      "commentaries": "commentaries",
      "selected": "selected",
      "keyInsights": "Key Insights",
      "commentaryQuotes": "Commentary Quotes",
      "crossReferences": "Cross References",
      "lifeApplication": "Life Application",
      "practicalApplications": "Practical Applications",
      "reflectionPoints": "Reflection Points",
      "actionSteps": "Action Steps",
      "additionalResources": "Additional Resources",
      "memoryVerses": "Memory Verses",
      "prayerPoints": "Prayer Points",
      "referenceAnswer": "Reference Answer",
      "referenceAnswerShort": "参考答案",
      "showReferenceAnswer": "Show Reference Answer",
      "hideReferenceAnswer": "Hide Reference Answer",
      "generatingAnswer": "Generating answer...",
      "answerGenerationFailed": "Failed to generate answer. Please try again.",
      "translateToChinese": "Translate to Chinese",
      "showOriginal": "Show Original",
      "translating": "Translating...",
      "translationFailed": "Translation failed. Please try again.",
      "downloadHeaders": {
        "title": "BIBLE STUDY GUIDE",
        "overview": "OVERVIEW",
        "introduction": "Introduction:",
        "historicalContext": "Historical Context:",
        "literaryContext": "Literary Context:",
        "exegesis": "VERSE-BY-VERSE EXEGESIS",
        "discussionQuestions": "DISCUSSION QUESTIONS",
        "lifeApplication": "LIFE APPLICATION",
        "practicalApplications": "Practical Applications:",
        "reflectionPoints": "Reflection Points:",
        "actionSteps": "Action Steps:",
        "additionalResources": "ADDITIONAL RESOURCES",
        "crossReferences": "Cross References:",
        "memoryVerses": "Memory Verses:",
        "prayerPoints": "Prayer Points:",
        "commentariesUsed": "COMMENTARIES USED",
        "generatedBy": "Generated by Bible Study Guide Generator - https://biblestudy.banaba.ai",
        "passage": "Passage:",
        "theology": "Theological Perspective:",
        "keyInsights": "Key Insights:",
        "explanation": "Explanation:"
      }
    }
  },
  zh: {
    translation: {
      "title": "圣经学习指南生成器",
      "subtitle": "为您的细胞小组事工生成全面的、符合圣经的学习指南",
      "studyConfig": "学习配置",
      "selectTheology": "选择您的神学立场：",
      "biblePassage": "圣经经文：",
      "passagePlaceholder": "例如：来6:4-6，太5:1-12，约3:16，罗8:28-39",
      "passageHint": "输入您想要学习的经文（书卷、章节和节数）",
      "generate": "生成学习指南",
      "generating": "正在生成学习指南...",
      "studyGuide": "学习指南",
      "download": "下载",
      "configurePrompt": "配置您的学习设置并生成全面的圣经学习指南",
      "perspective": "立场",
      "overview": "概览",
      "introduction": "简介：",
      "historicalContext": "历史背景：",
      "literaryContext": "文学背景：",
      "exegesis": "逐节解经",
      "discussionQuestions": "讨论问题",
      "commentariesUsed": "使用的注释书",
      "downloadPrompt": "将完整的学习指南导出为PDF文档",
      "features": {
        "theological": "神学立场",
        "theologicalDesc": "从主要神学立场中选择，确保您的学习指南与您教会的信仰一致",
        "comprehensive": "全面分析",
        "comprehensiveDesc": "基于受人尊敬的注释书和圣经学术的逐节解经",
        "groupReady": "小组准备",
        "groupReadyDesc": "为细胞小组讨论设计的发人深省的问题和实际应用"
      },
      "errors": {
        "selectBoth": "请选择神学立场并输入圣经经文。",
        "specifyVerses": "请指定经文，不只是章节。",
        "specifyChapter": "请指定章节和经文，不只是书卷。",
        "invalidFormat": "经文格式无效。",
        "unknownBook": "未知的书卷名称。",
        "tooManyVerses": "选择的经文太多，请选择较少的经文。",
        "serverError": "生成学习指南失败，请重试。"
      },
      "theology": {
        "calvinism": {
          "name": "改革宗/加尔文主义",
          "description": "强调上帝的主权、预定论和恩典教义"
        },
        "arminianism": {
          "name": "阿米念主义/卫斯理宗",
          "description": "强调自由意志、有条件的拣选和从恩典中堕落的可能性"
        },
        "dispensationalism": {
          "name": "时代论",
          "description": "强调不同的时代和对预言的字面解释"
        },
        "lutheranism": {
          "name": "路德宗",
          "description": "强调因信称义和圣礼神学"
        },
        "catholicism": {
          "name": "天主教",
          "description": "强调教会传统、教皇权威和圣礼生活"
        }
      },
      "andMore": "还有 {{count}} 个...",
      "moreVerses": "还有 {{count}} 节经文...",
      "moreQuestions": "还有 {{count}} 个问题...",
      "commentariesLabel": "注释书：",
      "selectCommentaries": "选择注释书",
      "hideCommentaries": "隐藏注释书",
      "selectUpTo": "最多选择",
      "commentaries": "本注释书",
      "selected": "已选择",
      "keyInsights": "关键洞察",
      "commentaryQuotes": "注释书引用",
      "crossReferences": "参考经文",
      "lifeApplication": "生活应用",
      "practicalApplications": "实际应用",
      "reflectionPoints": "反思要点",
      "actionSteps": "行动步骤",
      "additionalResources": "其他资源",
      "memoryVerses": "背诵经文",
      "prayerPoints": "祷告要点",
      "referenceAnswer": "参考答案",
      "referenceAnswerShort": "参考答案",
      "showReferenceAnswer": "显示参考答案",
      "hideReferenceAnswer": "隐藏参考答案",
      "generatingAnswer": "正在生成答案...",
      "answerGenerationFailed": "生成答案失败，请重试。",
      "translateToChinese": "翻译成中文",
      "showOriginal": "显示原文",
      "translating": "正在翻译...",
      "translationFailed": "翻译失败，请重试。",
      "downloadHeaders": {
        "title": "圣经学习指南",
        "overview": "概览",
        "introduction": "简介：",
        "historicalContext": "历史背景：",
        "literaryContext": "文学背景：",
        "exegesis": "逐节解经",
        "discussionQuestions": "讨论问题",
        "lifeApplication": "生活应用",
        "practicalApplications": "实际应用：",
        "reflectionPoints": "反思要点：",
        "actionSteps": "行动步骤：",
        "additionalResources": "其他资源",
        "crossReferences": "参考经文：",
        "memoryVerses": "背诵经文：",
        "prayerPoints": "祷告要点：",
        "commentariesUsed": "使用的注释书",
        "generatedBy": "由圣经学习指南生成器生成 - https://biblestudy.banaba.ai",
        "passage": "经文：",
        "theology": "神学立场：",
        "keyInsights": "关键洞察：",
        "explanation": "解释："
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,

    detection: {
      // Order and from where user language should be detected
      order: ['navigator', 'localStorage', 'sessionStorage', 'cookie', 'htmlTag'],
      
      // Keys or params to lookup language from
      lookupLocalStorage: 'i18nextLng',
      lookupSessionStorage: 'i18nextLng',
      lookupCookie: 'i18nextLng',
      
      // Cache user language on
      caches: ['localStorage'],
      
      // Only detect browser language if it's supported
      checkWhitelist: true
    },

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // Supported languages
    supportedLngs: ['en', 'zh'],
    nonExplicitSupportedLngs: true
  });

export default i18n;