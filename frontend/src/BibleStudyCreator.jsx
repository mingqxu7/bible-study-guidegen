import React, { useState } from 'react';
import { Book, Search, Download, Users, Cross, MessageSquare, Globe, CheckCircle, Clock, AlertCircle, Loader2, Moon, Sun, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudyHistory } from './hooks/useStudyHistory';
import { useDarkMode } from './hooks/useDarkMode';
import StudyHistoryPanel from './components/StudyHistoryPanel';
import FullStudyGuideView from './components/FullStudyGuideView';

// Use relative path for API which works for both development (with Vite proxy) and production (Vercel)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';


const BibleStudyCreator = () => {
  const { t, i18n } = useTranslation();
  const [selectedTheology, setSelectedTheology] = useState('');
  const [expandedTheology, setExpandedTheology] = useState(null);
  const [selectedCommentaries, setSelectedCommentaries] = useState({});
  const [verseInput, setVerseInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [error, setError] = useState('');
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [showFullView, setShowFullView] = useState(false);
  const [isDark, toggleDark] = useDarkMode();
  const { history, addEntry, removeEntry, clearHistory } = useStudyHistory();

  // Progress step component
  const ProgressStep = ({ step, isActive, isCompleted }) => {
    const getStepIcon = () => {
      if (isCompleted) return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      if (isActive) return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      return <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />;
    };

    const getStepStyle = () => {
      if (isCompleted) return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30';
      if (isActive) return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30';
      return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
    };

    return (
      <div className={`p-3 rounded-lg border ${getStepStyle()} transition-all duration-300`}>
        <div className="flex items-start gap-3">
          {getStepIcon()}
          <div className="flex-1">
            <p className={`text-sm font-medium ${isCompleted ? 'text-green-800 dark:text-green-300' : isActive ? 'text-blue-800 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
              {step.message}
            </p>
            {step.details && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {step.details.successful && (
                  <div>
                    <span className="font-medium">✓ Retrieved:</span> {step.details.successful.map(c => c.name).join(', ')}
                  </div>
                )}
                {step.details.failed && step.details.failed.length > 0 && (
                  <div className="text-red-600 dark:text-red-400">
                    <span className="font-medium">✗ Failed:</span> {step.details.failed.join(', ')}
                  </div>
                )}
                {step.details.usable && (
                  <div>
                    <span className="font-medium">📖 Usable:</span> {step.details.usable.join(', ')}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {step.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Function to translate error messages from backend
  const translateError = (errorMessage) => {
    if (!errorMessage || typeof errorMessage !== 'string') {
      return t('errors.serverError');
    }

    if (errorMessage.includes('Please specify verses, not just chapter') || errorMessage.includes('请指定经文，不只是章节')) {
      return t('errors.specifyVerses');
    }
    if (errorMessage.includes('Please specify chapter and verses, not just the book') || errorMessage.includes('请指定章节和经文，不只是书卷')) {
      return t('errors.specifyChapter');
    }
    if (errorMessage.includes('Unknown book') || errorMessage.includes('未知的书卷')) {
      return t('errors.unknownBook');
    }
    if (errorMessage.includes('Invalid verse format') || errorMessage.includes('经文格式无效')) {
      return t('errors.invalidFormat');
    }
    // For any other backend errors, return as is (they should already be in the correct language)
    return errorMessage;
  };

  const upsertProgressStep = (stepId, message, details = null) => {
    const newStep = {
      id: stepId,
      message,
      timestamp: new Date(),
      details
    };

    setProgressSteps(prevSteps => {
      const existingIndex = prevSteps.findIndex(step => step.id === stepId);
      if (existingIndex >= 0) {
        const updatedSteps = [...prevSteps];
        updatedSteps[existingIndex] = newStep;
        return updatedSteps;
      }
      return [...prevSteps, newStep];
    });

    setCurrentStep(stepId);
  };

  const finishGenerationSuccess = (generatedStudyGuide, verse, theologyId, stances, language) => {
    setStudyGuide(generatedStudyGuide);
    setCurrentStep('completed');
    setIsGenerating(false);

    const theologyName = stances.find(s => s.id === theologyId)?.name || theologyId;
    addEntry(generatedStudyGuide, verse, theologyName, language, theologyId);
  };

  const theologicalStances = [
    { 
      id: 'calvinism', 
      name: t('theology.calvinism.name'), 
      description: t('theology.calvinism.description'),
      commentaries: ['Calvin\'s Commentary', 'Matthew Henry', 'John Gill', 'Charles Spurgeon', 'Barnes\' Notes']
    },
    { 
      id: 'arminianism', 
      name: t('theology.arminianism.name'), 
      description: t('theology.arminianism.description'),
      commentaries: ['Wesley\'s Notes', 'Clarke\'s Commentary', 'Benson\'s Commentary', 'Whedon\'s Commentary']
    },
    { 
      id: 'dispensationalism', 
      name: t('theology.dispensationalism.name'), 
      description: t('theology.dispensationalism.description'),
      commentaries: ['Scofield\'s Notes', 'Darby\'s Synopsis', 'Ironside\'s Notes', 'McGee\'s Commentary']
    },
    { 
      id: 'lutheranism', 
      name: t('theology.lutheranism.name'), 
      description: t('theology.lutheranism.description'),
      commentaries: ['Kretzmann\'s Commentary', 'Bengel\'s Gnomon', 'Luther\'s Commentary']
    },
    { 
      id: 'catholicism', 
      name: t('theology.catholicism.name'), 
      description: t('theology.catholicism.description'),
      commentaries: ['Haydock\'s Commentary', 'Lapide\'s Commentary', 'Orchard\'s Commentary']
    }
  ];

  // When a theology is selected, default all its commentaries to selected
  const handleTheologySelect = (stanceId) => {
    setSelectedTheology(stanceId);
    if (!selectedCommentaries[stanceId]) {
      const stance = theologicalStances.find(s => s.id === stanceId);
      if (stance) {
        setSelectedCommentaries(prev => ({
          ...prev,
          [stanceId]: new Set(stance.commentaries),
        }));
      }
    }
  };

  const toggleCommentary = (stanceId, commentary) => {
    setSelectedCommentaries(prev => {
      const current = prev[stanceId] ? new Set(prev[stanceId]) : new Set();
      if (current.has(commentary)) {
        current.delete(commentary);
      } else {
        current.add(commentary);
      }
      return { ...prev, [stanceId]: current };
    });
  };

  // Build theologicalStances with only the selected commentaries for the active theology
  const getActiveStances = () => {
    return theologicalStances.map(stance => {
      if (stance.id === selectedTheology && selectedCommentaries[stance.id]) {
        return { ...stance, commentaries: stance.commentaries.filter(c => selectedCommentaries[stance.id].has(c)) };
      }
      return stance;
    });
  };

  const generateStudyGuide = async () => {
    if (!selectedTheology || !verseInput.trim()) {
      setError(t('errors.selectBoth'));
      return;
    }

    setIsGenerating(true);
    setError('');
    setStudyGuide(null);
    setProgressSteps([]);
    setCurrentStep(null);

    const requestBody = {
      verseInput,
      selectedTheology,
      theologicalStances: getActiveStances(),
      language: i18n.language
    };

    const isChinese = i18n.language === 'zh' || i18n.language.startsWith('zh');
    const fallbackStepMessage = isChinese
      ? '实时进度不可用，正在切换到标准生成模式...'
      : 'Live progress unavailable, switching to standard generation...';
    const fallbackGeneratingMessage = isChinese
      ? '正在生成学习指南...'
      : 'Generating study guide...';

    const generateWithPostFallback = async () => {
      try {
        upsertProgressStep('fallback_post', fallbackStepMessage);
        upsertProgressStep('generating_guide', fallbackGeneratingMessage);

        const response = await fetch(`${API_BASE_URL}/generate-study`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const raw = await response.text();
        let data = null;

        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          throw new Error(`Unexpected response format (HTTP ${response.status})`);
        }

        if (!response.ok) {
          throw new Error(data?.error || `Request failed (HTTP ${response.status})`);
        }

        finishGenerationSuccess(data, verseInput, selectedTheology, theologicalStances, i18n.language);
      } catch (fallbackError) {
        console.error('POST fallback generation error:', fallbackError);
        setError(translateError(fallbackError.message));
        setIsGenerating(false);
      }
    };

    let hasFinished = false;
    let hasStartedFallback = false;

    const startFallbackIfNeeded = async () => {
      if (hasFinished || hasStartedFallback) return;
      hasStartedFallback = true;
      await generateWithPostFallback();
      hasFinished = true;
    };

    try {
      const urlParams = new URLSearchParams({
        verseInput,
        selectedTheology,
        theologicalStances: JSON.stringify(getActiveStances()),
        language: i18n.language
      });

      const eventSource = new EventSource(`${API_BASE_URL}/generate-study-stream?${urlParams}`);

      eventSource.onmessage = (event) => {
        if (hasFinished) return;

        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            setError(translateError(data.error) || t('errors.serverError'));
            hasFinished = true;
            eventSource.close();
            setIsGenerating(false);
            return;
          }

          if (data.type === 'progress') {
            upsertProgressStep(data.step, data.message, data.details || null);
          } else if (data.type === 'complete') {
            hasFinished = true;
            eventSource.close();
            finishGenerationSuccess(data.data, verseInput, selectedTheology, theologicalStances, i18n.language);
          }
        } catch (parseError) {
          console.error('Failed to parse SSE data:', event.data);
          eventSource.close();
          void startFallbackIfNeeded();
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        void startFallbackIfNeeded();
      };

      // Cleanup function
      return () => {
        eventSource.close();
      };

    } catch (error) {
      console.error('Error setting up SSE:', error);
      await startFallbackIfNeeded();
    }
  };

  const handleHistorySelect = (entry) => {
    setStudyGuide(entry.studyGuide);
    setVerseInput(entry.passage);
    // Use theologyId if available (new format), fall back to matching by display name (legacy)
    if (entry.theologyId && theologicalStances.some(s => s.id === entry.theologyId)) {
      setSelectedTheology(entry.theologyId);
    } else {
      // Legacy entries without theologyId: try matching by display name
      const theologyEntry = theologicalStances.find(s => s.name === entry.theology);
      if (theologyEntry) {
        setSelectedTheology(theologyEntry.id);
      }
    }
    setError('');
    setProgressSteps([]);
    setCurrentStep(null);
  };

  const downloadStudyGuide = () => {
    if (!studyGuide) return;

    const safeString = (value) => typeof value === 'string' ? value : '';
    const safeArray = (value) => Array.isArray(value) ? value : [];

    const content = `${t('downloadHeaders.title')}
${safeString(studyGuide.title)}
${t('downloadHeaders.passage')} ${safeString(studyGuide.passage)}
${t('downloadHeaders.theology')} ${safeString(studyGuide.theology)}

===========================================

${t('downloadHeaders.overview')}

${t('downloadHeaders.introduction')}
${studyGuide.overview ? safeString(studyGuide.overview.introduction) : ''}

${t('downloadHeaders.historicalContext')}
${studyGuide.overview ? safeString(studyGuide.overview.historicalContext) : ''}

${t('downloadHeaders.literaryContext')}
${studyGuide.overview ? safeString(studyGuide.overview.literaryContext) : ''}

===========================================

${t('downloadHeaders.exegesis')}

${safeArray(studyGuide.exegesis).map(verse => `
${safeString(verse.verse)}: ${safeString(verse.text)}

${t('downloadHeaders.explanation')}
${safeString(verse.explanation)}

${t('downloadHeaders.keyInsights')}
${safeArray(verse.keyInsights).map(insight => `• ${safeString(insight)}`).join('\n')}

${t('downloadHeaders.crossReferences')}
${safeArray(verse.crossReferences).map(ref => safeString(ref)).join(', ')}
`).join('\n---\n')}

===========================================

${t('downloadHeaders.discussionQuestions')}

${safeArray(studyGuide.discussionQuestions).map((q, i) => `${i + 1}. ${safeString(q)}`).join('\n\n')}

===========================================

${t('downloadHeaders.lifeApplication')}

${t('downloadHeaders.practicalApplications')}
${studyGuide.lifeApplication ? safeArray(studyGuide.lifeApplication.practicalApplications).map(app => `• ${safeString(app)}`).join('\n') : ''}

${t('downloadHeaders.reflectionPoints')}
${studyGuide.lifeApplication ? safeArray(studyGuide.lifeApplication.reflectionPoints).map(point => `• ${safeString(point)}`).join('\n') : ''}

${t('downloadHeaders.actionSteps')}
${studyGuide.lifeApplication ? safeArray(studyGuide.lifeApplication.actionSteps).map(step => `• ${safeString(step)}`).join('\n') : ''}

===========================================

${t('downloadHeaders.additionalResources')}

${t('downloadHeaders.crossReferences')}
${studyGuide.additionalResources ? safeArray(studyGuide.additionalResources.crossReferences).map(ref => safeString(ref)).join(', ') : ''}

${t('downloadHeaders.memoryVerses')}
${studyGuide.additionalResources ? safeArray(studyGuide.additionalResources.memoryVerses).map(verse => safeString(verse)).join(', ') : ''}

${t('downloadHeaders.prayerPoints')}
${studyGuide.additionalResources ? safeArray(studyGuide.additionalResources.prayerPoints).map(point => `• ${safeString(point)}`).join('\n') : ''}

===========================================

${t('downloadHeaders.commentariesUsed')}

${studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0 
  ? studyGuide.commentariesUsed.map(c => `${safeString(c.citation)} ${safeString(c.name)} by ${safeString(c.author)}${c.url ? '\n    ' + safeString(c.url) : ''}`).join('\n\n')
  : 'No specific commentaries cited - general theological knowledge used'}

===========================================
${t('downloadHeaders.generatedBy')}`;

    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      // Create filename: use passage reference with book name for both languages
      let baseFilename;
      const passageText = studyGuide.passage || verseInput;
      
      // Clean the passage text to make it filename-safe
      baseFilename = passageText
        .replace(/[:\s]/g, '_')           // Replace colons and spaces with underscores
        .replace(/[^\w\u4e00-\u9fff_-]/g, '')  // Keep only alphanumeric, Chinese chars, underscores, hyphens
        .replace(/_+/g, '_')             // Replace multiple underscores with single
        .replace(/^_|_$/g, '');          // Remove leading/trailing underscores
      
      const studyGuideText = i18n.language.startsWith('zh') ? '学习指南' : 'Study_Guide';
      const filename = `${baseFilename}_${studyGuideText}.txt`;
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Download failed:', error);
      
      try {
        navigator.clipboard.writeText(content).then(() => {
          alert('Download failed, but the study guide has been copied to your clipboard. You can paste it into a text editor and save it manually.');
        });
      } catch (clipboardError) {
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap; padding: 20px;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
        newWindow.document.title = 'Bible Study Guide';
        alert('Download failed. The study guide is displayed in a new window. You can copy and paste the content to save it.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Cross className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">{t('title')}</h1>
            <Book className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Globe className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{i18n.language === 'en' ? '中文' : 'English'}</span>
            </button>
            <button
              onClick={toggleDark}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-yellow-500" />
              ) : (
                <Moon className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {t('studyConfig')}
              </h2>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('selectTheology')}
                </label>
                <div className="space-y-2">
                  {theologicalStances.map((stance) => {
                    const isSelected = selectedTheology === stance.id;
                    const isExpanded = expandedTheology === stance.id;
                    const stanceCommentaries = selectedCommentaries[stance.id] || new Set(stance.commentaries);
                    return (
                      <div
                        key={stance.id}
                        className={`border-2 rounded-lg transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
                            : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600'
                        }`}
                      >
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => handleTheologySelect(stance.id)}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="theology"
                              value={stance.id}
                              checked={isSelected}
                              onChange={() => handleTheologySelect(stance.id)}
                              className="text-indigo-600"
                            />
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{stance.name}</h3>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{stance.description}</p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  {t('commentariesLabel')} {stanceCommentaries.size}/{stance.commentaries.length} {i18n.language === 'zh' ? '已选' : 'selected'}
                                </p>
                                {isSelected && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedTheology(isExpanded ? null : stance.id);
                                    }}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-0.5"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    {isExpanded ? (i18n.language === 'zh' ? '收起' : 'Hide') : (i18n.language === 'zh' ? '选择注释书' : 'Select commentaries')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {isSelected && isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-indigo-200 dark:border-indigo-700">
                            <div className="mt-2 space-y-1.5 pl-7">
                              {stance.commentaries.map((commentary) => (
                                <label
                                  key={commentary}
                                  className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                  <input
                                    type="checkbox"
                                    checked={stanceCommentaries.has(commentary)}
                                    onChange={() => toggleCommentary(stance.id, commentary)}
                                    className="rounded text-indigo-600 w-3.5 h-3.5"
                                  />
                                  {commentary}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('biblePassage')}
                </label>
                <input
                  type="text"
                  value={verseInput}
                  onChange={(e) => setVerseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isGenerating) generateStudyGuide(); }}
                  placeholder={t('passagePlaceholder')}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('passageHint')}
                </p>
              </div>

              <button
                onClick={generateStudyGuide}
                disabled={isGenerating || !selectedTheology || !verseInput.trim()}
                className="w-full bg-indigo-600 dark:bg-indigo-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {i18n.language === 'zh' ? '正在生成...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    {t('generate')}
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>

            {/* History Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700">
              <StudyHistoryPanel
                history={history}
                onSelect={handleHistorySelect}
                onRemove={removeEntry}
                onClear={clearHistory}
              />
            </div>
          </div>

          {/* Right Column: Study Guide */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  {t('studyGuide')}
                </h2>
                {studyGuide && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowFullView(true)}
                      className="bg-indigo-600 dark:bg-indigo-700 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors flex items-center gap-2 text-sm"
                      title={i18n.language === 'zh' ? '全屏查看' : 'Full view'}
                    >
                      <Maximize2 className="w-4 h-4" />
                      {i18n.language === 'zh' ? '全屏' : 'Full View'}
                    </button>
                    <button
                      onClick={downloadStudyGuide}
                      className="bg-green-600 dark:bg-green-700 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      {t('download')}
                    </button>
                  </div>
                )}
              </div>

              {!studyGuide && !isGenerating && (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <Book className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p>{t('configurePrompt')}</p>
                </div>
              )}

              {isGenerating && (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                      {i18n.language === 'zh' ? '正在生成学习指南...' : 'Generating Study Guide...'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {i18n.language === 'zh' ? '请查看下方的详细进度信息' : 'See detailed progress information below'}
                    </p>
                  </div>
                  
                  {progressSteps.length > 0 && (
                    <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto">
                      {progressSteps.map((step, index) => {
                        const stepOrder = ['parsing', 'parsed', 'retrieving_commentaries', 'commentaries_retrieved', 'filtering_commentaries', 'commentaries_filtered', 'generating_guide', 'completed'];
                        const isActive = currentStep === step.id;
                        const currentIndex = stepOrder.indexOf(currentStep);
                        const stepIndex = stepOrder.indexOf(step.id);
                        const isCompleted = stepIndex < currentIndex || currentStep === 'completed';
                        
                        return (
                          <ProgressStep 
                            key={step.id} 
                            step={step} 
                            isActive={isActive}
                            isCompleted={isCompleted}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {studyGuide && (
                <div className="space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  <div className="text-center border-b dark:border-gray-700 pb-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{typeof studyGuide.title === 'string' ? studyGuide.title : 'Study Guide'}</h3>
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">{typeof studyGuide.passage === 'string' ? studyGuide.passage : ''}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{typeof studyGuide.theology === 'string' ? studyGuide.theology : ''} {t('perspective')}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('overview')}</h4>
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                      <p><strong>{t('introduction')}</strong> {studyGuide.overview && typeof studyGuide.overview.introduction === 'string' ? studyGuide.overview.introduction : 'No introduction available'}</p>
                      <p><strong>{t('historicalContext')}</strong> {studyGuide.overview && typeof studyGuide.overview.historicalContext === 'string' ? studyGuide.overview.historicalContext : 'No historical context available'}</p>
                      <p><strong>{t('literaryContext')}</strong> {studyGuide.overview && typeof studyGuide.overview.literaryContext === 'string' ? studyGuide.overview.literaryContext : 'No literary context available'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('exegesis')}</h4>
                    <div className="space-y-3">
                      {studyGuide.exegesis && Array.isArray(studyGuide.exegesis) ? studyGuide.exegesis.slice(0, 4).map((verse, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded border border-gray-100 dark:border-gray-600">
                          <p className="font-medium text-indigo-600 dark:text-indigo-400">{typeof verse.verse === 'string' ? verse.verse : `Verse ${index + 1}`}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{typeof verse.explanation === 'string' ? verse.explanation.substring(0, 300) + (verse.explanation.length > 300 ? '...' : '') : 'No explanation available'}</p>
                        </div>
                      )) : <p className="text-sm text-gray-500 dark:text-gray-400">No exegesis available</p>}
                      {studyGuide.exegesis && Array.isArray(studyGuide.exegesis) && studyGuide.exegesis.length > 4 && (
                        <button
                          onClick={() => setShowFullView(true)}
                          className="w-full text-center py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium"
                        >
                          {t('moreVerses', { count: studyGuide.exegesis.length - 4 })} →{' '}
                          {i18n.language === 'zh' ? '点击查看全部' : 'Click to view all'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('discussionQuestions')}</h4>
                    <div className="space-y-2">
                      {studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions) ? studyGuide.discussionQuestions.slice(0, 3).map((question, index) => (
                        <p key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          {index + 1}. {typeof question === 'string' ? question : 'Discussion question'}
                        </p>
                      )) : <p className="text-sm text-gray-500 dark:text-gray-400">No discussion questions available</p>}
                      {studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions) && studyGuide.discussionQuestions.length > 3 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          {t('moreQuestions', { count: studyGuide.discussionQuestions.length - 3 })}
                        </p>
                      )}
                    </div>
                  </div>

                  {studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('commentariesUsed')}</h4>
                      <div className="space-y-1">
                        {studyGuide.commentariesUsed.map((commentary, index) => (
                          <div key={index} className="text-sm text-gray-700 dark:text-gray-300">
                            <p>
                              <span className="font-medium text-indigo-600 dark:text-indigo-400">{typeof commentary.citation === 'string' ? commentary.citation : `[${index + 1}]`}</span> {typeof commentary.name === 'string' ? commentary.name : 'Commentary'} by {typeof commentary.author === 'string' ? commentary.author : 'Unknown'}
                            </p>
                            {commentary.url && typeof commentary.url === 'string' && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 ml-6">
                                <a href={commentary.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {commentary.url}
                                </a>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-center pt-4 border-t dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('downloadPrompt')}
                    </p>
                    <button
                      onClick={() => setShowFullView(true)}
                      className="mt-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium inline-flex items-center gap-1"
                    >
                      <Maximize2 className="w-4 h-4" />
                      {i18n.language === 'zh' ? '查看完整学习指南（含全部经文解析）' : 'View full study guide with all verse explanations'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700">
            <Cross className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('features.theological')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('features.theologicalDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700">
            <Book className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('features.comprehensive')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('features.comprehensiveDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700">
            <Users className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('features.groupReady')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('features.groupReadyDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Full Study Guide Modal */}
      {showFullView && studyGuide && (
        <FullStudyGuideView
          studyGuide={studyGuide}
          onClose={() => setShowFullView(false)}
        />
      )}
    </div>
  );
};

export default BibleStudyCreator;
