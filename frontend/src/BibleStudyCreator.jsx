import React, { useState } from 'react';
import { Book, Search, Download, Users, Cross, MessageSquare, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Use relative path for API which works for both development (with Vite proxy) and production (Vercel)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';


const BibleStudyCreator = () => {
  const { t, i18n } = useTranslation();
  const [selectedTheology, setSelectedTheology] = useState('');
  const [verseInput, setVerseInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [error, setError] = useState('');

  // Function to translate error messages from backend
  const translateError = (errorMessage) => {
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

  const generateStudyGuide = async () => {
    if (!selectedTheology || !verseInput.trim()) {
      setError(t('errors.selectBoth'));
      return;
    }

    setIsGenerating(true);
    setError('');
    setStudyGuide(null);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-study`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verseInput,
          selectedTheology,
          theologicalStances,
          language: i18n.language
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate study guide';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || `Server error: ${response.status}`;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Check if response has content
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      // Try to parse JSON
      let studyData;
      try {
        studyData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response format from server');
      }
      
      setStudyGuide(studyData);
    } catch (error) {
      console.error('Error generating study guide:', error);
      setError(translateError(error.message) || t('errors.serverError'));
    } finally {
      setIsGenerating(false);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Cross className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">{t('title')}</h1>
            <Book className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
          <div className="mt-4">
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium">{i18n.language === 'en' ? '中文' : 'English'}</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              {t('studyConfig')}
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('selectTheology')}
              </label>
              <div className="space-y-3">
                {theologicalStances.map((stance) => (
                  <div
                    key={stance.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTheology === stance.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                    onClick={() => setSelectedTheology(stance.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="theology"
                        value={stance.id}
                        checked={selectedTheology === stance.id}
                        onChange={() => setSelectedTheology(stance.id)}
                        className="text-indigo-600"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-800">{stance.name}</h3>
                        <p className="text-sm text-gray-600">{stance.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('commentariesLabel')} {stance.commentaries.slice(0, 3).join(', ')}
                          {stance.commentaries.length > 3 && '...'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('biblePassage')}
              </label>
              <input
                type="text"
                value={verseInput}
                onChange={(e) => setVerseInput(e.target.value)}
                placeholder={t('passagePlaceholder')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('passageHint')}
              </p>
            </div>

            <button
              onClick={generateStudyGuide}
              disabled={isGenerating || !selectedTheology || !verseInput.trim()}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('generating')}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t('generate')}
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                {t('studyGuide')}
              </h2>
              {studyGuide && (
                <button
                  onClick={downloadStudyGuide}
                  className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t('download')}
                </button>
              )}
            </div>

            {!studyGuide && !isGenerating && (
              <div className="text-center py-12 text-gray-500">
                <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>{t('configurePrompt')}</p>
              </div>
            )}

            {studyGuide && (
              <div className="space-y-6 max-h-96 overflow-y-auto">
                <div className="text-center border-b pb-4">
                  <h3 className="text-xl font-bold text-gray-800">{typeof studyGuide.title === 'string' ? studyGuide.title : 'Study Guide'}</h3>
                  <p className="text-indigo-600 font-medium">{typeof studyGuide.passage === 'string' ? studyGuide.passage : ''}</p>
                  <p className="text-sm text-gray-600">{typeof studyGuide.theology === 'string' ? studyGuide.theology : ''} {t('perspective')}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">{t('overview')}</h4>
                  <div className="text-sm text-gray-700 space-y-2">
                    <p><strong>{t('introduction')}</strong> {studyGuide.overview && typeof studyGuide.overview.introduction === 'string' ? studyGuide.overview.introduction : 'No introduction available'}</p>
                    <p><strong>{t('historicalContext')}</strong> {studyGuide.overview && typeof studyGuide.overview.historicalContext === 'string' ? studyGuide.overview.historicalContext : 'No historical context available'}</p>
                    <p><strong>{t('literaryContext')}</strong> {studyGuide.overview && typeof studyGuide.overview.literaryContext === 'string' ? studyGuide.overview.literaryContext : 'No literary context available'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">{t('exegesis')}</h4>
                  <div className="space-y-3">
                    {studyGuide.exegesis && Array.isArray(studyGuide.exegesis) ? studyGuide.exegesis.slice(0, 2).map((verse, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <p className="font-medium text-indigo-600">{typeof verse.verse === 'string' ? verse.verse : `Verse ${index + 1}`}</p>
                        <p className="text-sm text-gray-700 mt-1">{typeof verse.explanation === 'string' ? verse.explanation.substring(0, 200) + '...' : 'No explanation available'}</p>
                      </div>
                    )) : <p className="text-sm text-gray-500">No exegesis available</p>}
                    {studyGuide.exegesis && Array.isArray(studyGuide.exegesis) && studyGuide.exegesis.length > 2 && (
                      <p className="text-sm text-gray-500 italic">
                        {t('moreVerses', { count: studyGuide.exegesis.length - 2 })}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">{t('discussionQuestions')}</h4>
                  <div className="space-y-2">
                    {studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions) ? studyGuide.discussionQuestions.slice(0, 3).map((question, index) => (
                      <p key={index} className="text-sm text-gray-700">
                        {index + 1}. {typeof question === 'string' ? question : 'Discussion question'}
                      </p>
                    )) : <p className="text-sm text-gray-500">No discussion questions available</p>}
                    {studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions) && studyGuide.discussionQuestions.length > 3 && (
                      <p className="text-sm text-gray-500 italic">
                        {t('moreQuestions', { count: studyGuide.discussionQuestions.length - 3 })}
                      </p>
                    )}
                  </div>
                </div>

                {studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">{t('commentariesUsed')}</h4>
                    <div className="space-y-1">
                      {studyGuide.commentariesUsed.map((commentary, index) => (
                        <div key={index} className="text-sm text-gray-700">
                          <p>
                            <span className="font-medium text-indigo-600">{typeof commentary.citation === 'string' ? commentary.citation : `[${index + 1}]`}</span> {typeof commentary.name === 'string' ? commentary.name : 'Commentary'} by {typeof commentary.author === 'string' ? commentary.author : 'Unknown'}
                          </p>
                          {commentary.url && typeof commentary.url === 'string' && (
                            <p className="text-xs text-blue-600 ml-6">
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

                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    {t('downloadPrompt')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Cross className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('features.theological')}</h3>
            <p className="text-gray-600 text-sm">
              {t('features.theologicalDesc')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Book className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('features.comprehensive')}</h3>
            <p className="text-gray-600 text-sm">
              {t('features.comprehensiveDesc')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Users className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('features.groupReady')}</h3>
            <p className="text-gray-600 text-sm">
              {t('features.groupReadyDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleStudyCreator;