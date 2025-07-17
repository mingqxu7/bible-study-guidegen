import React, { useState, useRef } from 'react';
import { Book, Search, Download, Users, Cross, MessageSquare, Globe, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
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
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const studyGuideRef = useRef(null);

  // Progress step component
  const ProgressStep = ({ step, isActive, isCompleted }) => {
    const getStepIcon = () => {
      if (isCompleted) return <CheckCircle className="w-5 h-5 text-green-600" />;
      if (isActive) return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      return <Clock className="w-5 h-5 text-gray-400" />;
    };

    const getStepStyle = () => {
      if (isCompleted) return 'border-green-200 bg-green-50';
      if (isActive) return 'border-blue-200 bg-blue-50';
      return 'border-gray-200 bg-gray-50';
    };

    return (
      <div className={`p-3 rounded-lg border ${getStepStyle()} transition-all duration-300`}>
        <div className="flex items-start gap-3">
          {getStepIcon()}
          <div className="flex-1">
            <p className={`text-sm font-medium ${isCompleted ? 'text-green-800' : isActive ? 'text-blue-800' : 'text-gray-600'}`}>
              {step.message}
            </p>
            {step.details && (
              <div className="mt-2 text-xs text-gray-600">
                {step.details.successful && (
                  <div>
                    <span className="font-medium">✓ Retrieved:</span> {step.details.successful.map(c => c.name).join(', ')}
                  </div>
                )}
                {step.details.failed && step.details.failed.length > 0 && (
                  <div className="text-red-600">
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
            <p className="text-xs text-gray-500 mt-1">
              {step.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
  };

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
    setProgressSteps([]);
    setCurrentStep(null);

    try {
      const urlParams = new URLSearchParams({
        verseInput,
        selectedTheology,
        theologicalStances: JSON.stringify(theologicalStances),
        language: i18n.language
      });

      const eventSource = new EventSource(`${API_BASE_URL}/generate-study-stream?${urlParams}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            setError(translateError(data.error) || t('errors.serverError'));
            eventSource.close();
            setIsGenerating(false);
            return;
          }

          if (data.type === 'progress') {
            const newStep = {
              id: data.step,
              message: data.message,
              timestamp: new Date(),
              details: data.details || null
            };
            
            setProgressSteps(prevSteps => {
              const existingIndex = prevSteps.findIndex(step => step.id === data.step);
              if (existingIndex >= 0) {
                const updatedSteps = [...prevSteps];
                updatedSteps[existingIndex] = newStep;
                return updatedSteps;
              } else {
                return [...prevSteps, newStep];
              }
            });
            
            setCurrentStep(data.step);
          } else if (data.type === 'complete') {
            setStudyGuide(data.data);
            setCurrentStep('completed');
            eventSource.close();
            setIsGenerating(false);
          }
        } catch (parseError) {
          console.error('Failed to parse SSE data:', event.data);
          setError(t('errors.serverError'));
          eventSource.close();
          setIsGenerating(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        
        // Fallback to regular POST request if SSE fails
        console.log('SSE failed, falling back to regular API call...');
        fallbackToRegularAPI();
      };

      // Cleanup function
      return () => {
        eventSource.close();
      };

    } catch (error) {
      console.error('Error setting up SSE:', error);
      // Fallback to regular API call
      fallbackToRegularAPI();
    }
  };

  // Fallback function for when SSE fails
  const fallbackToRegularAPI = async () => {
    try {
      // Add a progress step for fallback
      setProgressSteps([{
        id: 'fallback',
        message: i18n.language === 'zh' ? '实时更新不可用，使用标准模式生成...' : 'Real-time updates unavailable, using standard mode...',
        timestamp: new Date(),
        details: null
      }]);
      setCurrentStep('fallback');

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
          try {
            const errorText = await response.text();
            errorMessage = errorText || `Server error: ${response.status}`;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      let studyData;
      try {
        studyData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response format from server');
      }
      
      setStudyGuide(studyData);
      setCurrentStep('completed');
      setIsGenerating(false);
    } catch (error) {
      console.error('Error in fallback API call:', error);
      setError(translateError(error.message) || t('errors.serverError'));
      setIsGenerating(false);
    }
  };

  const exportToPDF = () => {
    if (!studyGuide) return;

    try {
      // Helper functions
      const safeString = (value) => typeof value === 'string' ? value : '';
      const safeArray = (value) => Array.isArray(value) ? value : [];

      // Create filename for the window title
      const passageText = studyGuide.passage || verseInput;
      const baseFilename = passageText
        .replace(/[:\s]/g, '_')
        .replace(/[^\w\u4e00-\u9fff_-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      const studyGuideText = i18n.language.startsWith('zh') ? '学习指南' : 'Study Guide';
      const documentTitle = `${baseFilename} ${studyGuideText}`;

      // Build complete HTML document
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${documentTitle}</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.5;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            h1 { font-size: 24px; color: #2c3e50; margin: 0 0 10px 0; }
            h2 { font-size: 20px; color: #2c3e50; margin: 20px 0 15px 0; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
            h3 { font-size: 16px; color: #34495e; margin: 15px 0 8px 0; }
            h4 { font-size: 14px; color: #34495e; margin: 10px 0 5px 0; font-weight: bold; }
            p { margin: 0 0 10px 0; text-align: justify; }
            ul, ol { margin: 0; padding-left: 20px; }
            li { margin-bottom: 5px; }
            blockquote { 
              margin: 0 0 10px 0; 
              padding: 10px; 
              background: #f8f9fa; 
              border-left: 3px solid #bdc3c7; 
              font-style: italic; 
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              padding: 20px; 
              background: #f8f9fa; 
              border-radius: 8px; 
            }
            .section { 
              margin-bottom: 30px; 
              padding: 20px; 
              border: 1px solid #e0e0e0; 
              border-radius: 8px; 
            }
            .verse-block { 
              margin-bottom: 20px; 
              padding-left: 15px; 
              border-left: 3px solid #3498db; 
            }
            .verse-title { 
              font-size: 18px; 
              color: #2980b9; 
              font-weight: bold; 
              margin: 0 0 10px 0; 
            }
            .question-number { 
              color: #2980b9; 
              font-weight: bold; 
            }
            .commentary { 
              margin-bottom: 10px; 
              padding: 10px; 
              background: white; 
              border-radius: 4px; 
            }
            .commentary-section { 
              background: #f8f9fa; 
            }
            .footer { 
              text-align: center; 
              margin-top: 40px; 
              padding: 20px; 
              background: #f8f9fa; 
              border-radius: 8px; 
              font-size: 12px; 
              color: #7f8c8d; 
            }
            .print-button {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #3498db;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
              z-index: 1000;
            }
            .print-button:hover {
              background: #2980b9;
            }
            @media print {
              .print-button { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-button no-print" onclick="window.print()">
            ${i18n.language === 'zh' ? '打印/保存为PDF' : 'Print/Save as PDF'}
          </button>
          
          <div class="header">
            <h1>${safeString(studyGuide.title)}</h1>
            <p style="font-size: 18px; color: #3498db; font-weight: bold; margin: 0 0 5px 0;">${safeString(studyGuide.passage)}</p>
            <p style="font-size: 14px; color: #7f8c8d; margin: 0;">${safeString(studyGuide.theology)} ${t('perspective')}</p>
          </div>
      `;

      // Overview Section
      if (studyGuide.overview) {
        htmlContent += `
          <div class="section">
            <h2>${t('overview')}</h2>
            <div style="margin-bottom: 15px;">
              <h3>${t('introduction')}</h3>
              <p>${safeString(studyGuide.overview.introduction)}</p>
            </div>
            <div style="margin-bottom: 15px;">
              <h3>${t('historicalContext')}</h3>
              <p>${safeString(studyGuide.overview.historicalContext)}</p>
            </div>
            <div>
              <h3>${t('literaryContext')}</h3>
              <p>${safeString(studyGuide.overview.literaryContext)}</p>
            </div>
          </div>
        `;
      }

      // Exegesis Section
      if (studyGuide.exegesis && Array.isArray(studyGuide.exegesis)) {
        htmlContent += `<div class="section"><h2>${t('exegesis')}</h2>`;
        
        studyGuide.exegesis.forEach(verse => {
          htmlContent += `
            <div class="verse-block">
              <div class="verse-title">${safeString(verse.verse)}</div>
              ${verse.text ? `<blockquote>"${safeString(verse.text)}"</blockquote>` : ''}
              <p>${safeString(verse.explanation)}</p>
          `;
          
          if (verse.keyInsights && Array.isArray(verse.keyInsights) && verse.keyInsights.length > 0) {
            htmlContent += `
              <div style="margin-bottom: 10px;">
                <h4>${t('keyInsights')}</h4>
                <ul>
            `;
            verse.keyInsights.forEach(insight => {
              htmlContent += `<li>${safeString(insight)}</li>`;
            });
            htmlContent += `</ul></div>`;
          }
          
          if (verse.crossReferences && Array.isArray(verse.crossReferences) && verse.crossReferences.length > 0) {
            htmlContent += `
              <div>
                <h4>${t('crossReferences')}</h4>
                <p style="font-size: 12px; color: #7f8c8d;">${verse.crossReferences.join(' • ')}</p>
              </div>
            `;
          }
          
          htmlContent += `</div>`;
        });
        
        htmlContent += `</div>`;
      }

      // Discussion Questions
      if (studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions)) {
        htmlContent += `<div class="section"><h2>${t('discussionQuestions')}</h2>`;
        
        studyGuide.discussionQuestions.forEach((question, index) => {
          htmlContent += `
            <div style="margin-bottom: 10px;">
              <span class="question-number">${index + 1}.</span> ${safeString(question)}
            </div>
          `;
        });
        
        htmlContent += `</div>`;
      }

      // Life Application
      if (studyGuide.lifeApplication) {
        htmlContent += `<div class="section"><h2>${t('lifeApplication')}</h2>`;
        
        if (studyGuide.lifeApplication.practicalApplications && Array.isArray(studyGuide.lifeApplication.practicalApplications)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('practicalApplications')}</h3>
              <ul>
          `;
          studyGuide.lifeApplication.practicalApplications.forEach(app => {
            htmlContent += `<li>${safeString(app)}</li>`;
          });
          htmlContent += `</ul></div>`;
        }
        
        if (studyGuide.lifeApplication.reflectionPoints && Array.isArray(studyGuide.lifeApplication.reflectionPoints)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('reflectionPoints')}</h3>
              <ul>
          `;
          studyGuide.lifeApplication.reflectionPoints.forEach(point => {
            htmlContent += `<li>${safeString(point)}</li>`;
          });
          htmlContent += `</ul></div>`;
        }
        
        if (studyGuide.lifeApplication.actionSteps && Array.isArray(studyGuide.lifeApplication.actionSteps)) {
          htmlContent += `
            <div>
              <h3>${t('actionSteps')}</h3>
              <ol>
          `;
          studyGuide.lifeApplication.actionSteps.forEach(step => {
            htmlContent += `<li>${safeString(step)}</li>`;
          });
          htmlContent += `</ol></div>`;
        }
        
        htmlContent += `</div>`;
      }

      // Additional Resources
      if (studyGuide.additionalResources) {
        htmlContent += `<div class="section"><h2>${t('additionalResources')}</h2>`;
        
        if (studyGuide.additionalResources.crossReferences && Array.isArray(studyGuide.additionalResources.crossReferences)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('crossReferences')}</h3>
              <p>${studyGuide.additionalResources.crossReferences.join(' • ')}</p>
            </div>
          `;
        }
        
        if (studyGuide.additionalResources.memoryVerses && Array.isArray(studyGuide.additionalResources.memoryVerses)) {
          htmlContent += `
            <div style="margin-bottom: 15px;">
              <h3>${t('memoryVerses')}</h3>
              <p>${studyGuide.additionalResources.memoryVerses.join(' • ')}</p>
            </div>
          `;
        }
        
        if (studyGuide.additionalResources.prayerPoints && Array.isArray(studyGuide.additionalResources.prayerPoints)) {
          htmlContent += `
            <div>
              <h3>${t('prayerPoints')}</h3>
              <ul>
          `;
          studyGuide.additionalResources.prayerPoints.forEach(point => {
            htmlContent += `<li>${safeString(point)}</li>`;
          });
          htmlContent += `</ul></div>`;
        }
        
        htmlContent += `</div>`;
      }

      // Commentaries Used
      if (studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0) {
        htmlContent += `<div class="section commentary-section"><h2>${t('commentariesUsed')}</h2>`;
        
        studyGuide.commentariesUsed.forEach(commentary => {
          htmlContent += `
            <div class="commentary">
              <p>
                <strong style="color: #2980b9;">${safeString(commentary.citation)}</strong> 
                <strong>${safeString(commentary.name)}</strong> 
                by <em>${safeString(commentary.author)}</em>
              </p>
              ${commentary.url ? `<p style="font-size: 11px; color: #7f8c8d; margin: 5px 0 0 0;">Source: ${safeString(commentary.url)}</p>` : ''}
            </div>
          `;
        });
        
        htmlContent += `</div>`;
      }

      // Footer
      htmlContent += `
          <div class="footer">
            <p>${t('downloadHeaders.generatedBy')}</p>
          </div>
        </body>
        </html>
      `;

      // Open in new window
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Show instructions
      const message = i18n.language === 'zh' 
        ? '请在新窗口中点击"打印/保存为PDF"按钮，然后选择"另存为PDF"' 
        : 'Please click the "Print/Save as PDF" button in the new window, then choose "Save as PDF"';
      
      // Set timeout to show message after window opens
      setTimeout(() => {
        alert(message);
      }, 500);

    } catch (error) {
      console.error('PDF export failed:', error);
      alert(i18n.language === 'zh' ? 'PDF导出失败，请重试' : 'PDF export failed, please try again');
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
                  <Search className="w-5 h-5 opacity-50" />
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
                  onClick={exportToPDF}
                  className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {i18n.language === 'zh' ? '导出PDF' : 'Export PDF'}
                </button>
              )}
            </div>

            {!studyGuide && !isGenerating && (
              <div className="text-center py-12 text-gray-500">
                <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>{t('configurePrompt')}</p>
              </div>
            )}

            {isGenerating && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <Loader2 className="w-8 h-8 mx-auto mb-4 text-indigo-600 animate-spin" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {i18n.language === 'zh' ? '正在生成学习指南...' : 'Generating Study Guide...'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {i18n.language === 'zh' ? '请查看下方的详细进度信息' : 'See detailed progress information below'}
                  </p>
                </div>
                
                {progressSteps.length > 0 && (
                  <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto">
                    {progressSteps.map((step, index) => {
                      const stepOrder = ['parsing', 'parsed', 'retrieving_commentaries', 'commentaries_retrieved', 'filtering_commentaries', 'commentaries_filtered', 'generating_guide', 'fallback', 'completed'];
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
              <div ref={studyGuideRef} className="space-y-8 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2">
                {/* Header Section */}
                <div className="text-center bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-6 shadow-sm">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{typeof studyGuide.title === 'string' ? studyGuide.title : 'Study Guide'}</h3>
                  <p className="text-lg text-indigo-700 font-semibold mb-1">{typeof studyGuide.passage === 'string' ? studyGuide.passage : ''}</p>
                  <p className="text-sm text-gray-600 font-medium">{typeof studyGuide.theology === 'string' ? studyGuide.theology : ''} {t('perspective')}</p>
                </div>

                {/* Overview Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                    {t('overview')}
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">{t('introduction')}</h5>
                      <p className="text-gray-700 leading-relaxed">
                        {studyGuide.overview && typeof studyGuide.overview.introduction === 'string' ? studyGuide.overview.introduction : 'No introduction available'}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">{t('historicalContext')}</h5>
                      <p className="text-gray-700 leading-relaxed">
                        {studyGuide.overview && typeof studyGuide.overview.historicalContext === 'string' ? studyGuide.overview.historicalContext : 'No historical context available'}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">{t('literaryContext')}</h5>
                      <p className="text-gray-700 leading-relaxed">
                        {studyGuide.overview && typeof studyGuide.overview.literaryContext === 'string' ? studyGuide.overview.literaryContext : 'No literary context available'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verse-by-Verse Exegesis */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                    {t('exegesis')}
                  </h4>
                  <div className="space-y-6">
                    {studyGuide.exegesis && Array.isArray(studyGuide.exegesis) ? studyGuide.exegesis.map((verse, index) => (
                      <div key={index} className="border-l-4 border-indigo-200 pl-4 py-2">
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="font-bold text-indigo-700 text-lg">{typeof verse.verse === 'string' ? verse.verse : `Verse ${index + 1}`}</span>
                        </div>
                        {verse.text && (
                          <blockquote className="italic text-gray-600 mb-3 bg-gray-50 p-3 rounded">
                            "{typeof verse.text === 'string' ? verse.text : ''}"
                          </blockquote>
                        )}
                        <p className="text-gray-700 leading-relaxed mb-3">
                          {typeof verse.explanation === 'string' ? verse.explanation : 'No explanation available'}
                        </p>
                        {verse.keyInsights && Array.isArray(verse.keyInsights) && verse.keyInsights.length > 0 && (
                          <div className="mb-3">
                            <h6 className="font-semibold text-gray-800 mb-2">{t('keyInsights')}</h6>
                            <ul className="list-disc list-inside space-y-1">
                              {verse.keyInsights.map((insight, i) => (
                                <li key={i} className="text-gray-700">{insight}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {verse.crossReferences && Array.isArray(verse.crossReferences) && verse.crossReferences.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 mb-1">{t('crossReferences')}</h6>
                            <p className="text-sm text-gray-600">{verse.crossReferences.join(' • ')}</p>
                          </div>
                        )}
                      </div>
                    )) : <p className="text-gray-500">No exegesis available</p>}
                  </div>
                </div>

                {/* Discussion Questions */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                    {t('discussionQuestions')}
                  </h4>
                  <div className="space-y-3">
                    {studyGuide.discussionQuestions && Array.isArray(studyGuide.discussionQuestions) ? studyGuide.discussionQuestions.map((question, index) => (
                      <div key={index} className="flex gap-3">
                        <span className="font-bold text-indigo-600 flex-shrink-0">{index + 1}.</span>
                        <p className="text-gray-700 leading-relaxed">{typeof question === 'string' ? question : 'Discussion question'}</p>
                      </div>
                    )) : <p className="text-gray-500">No discussion questions available</p>}
                  </div>
                </div>

                {/* Life Application */}
                {studyGuide.lifeApplication && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                      {t('lifeApplication')}
                    </h4>
                    <div className="space-y-4">
                      {studyGuide.lifeApplication.practicalApplications && Array.isArray(studyGuide.lifeApplication.practicalApplications) && studyGuide.lifeApplication.practicalApplications.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('practicalApplications')}</h5>
                          <ul className="list-disc list-inside space-y-2">
                            {studyGuide.lifeApplication.practicalApplications.map((app, i) => (
                              <li key={i} className="text-gray-700">{app}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {studyGuide.lifeApplication.reflectionPoints && Array.isArray(studyGuide.lifeApplication.reflectionPoints) && studyGuide.lifeApplication.reflectionPoints.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('reflectionPoints')}</h5>
                          <ul className="list-disc list-inside space-y-2">
                            {studyGuide.lifeApplication.reflectionPoints.map((point, i) => (
                              <li key={i} className="text-gray-700">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {studyGuide.lifeApplication.actionSteps && Array.isArray(studyGuide.lifeApplication.actionSteps) && studyGuide.lifeApplication.actionSteps.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('actionSteps')}</h5>
                          <ol className="list-decimal list-inside space-y-2">
                            {studyGuide.lifeApplication.actionSteps.map((step, i) => (
                              <li key={i} className="text-gray-700">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Resources */}
                {studyGuide.additionalResources && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-indigo-600 rounded"></div>
                      {t('additionalResources')}
                    </h4>
                    <div className="space-y-4">
                      {studyGuide.additionalResources.crossReferences && Array.isArray(studyGuide.additionalResources.crossReferences) && studyGuide.additionalResources.crossReferences.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('crossReferences')}</h5>
                          <p className="text-gray-700">{studyGuide.additionalResources.crossReferences.join(' • ')}</p>
                        </div>
                      )}
                      {studyGuide.additionalResources.memoryVerses && Array.isArray(studyGuide.additionalResources.memoryVerses) && studyGuide.additionalResources.memoryVerses.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('memoryVerses')}</h5>
                          <p className="text-gray-700">{studyGuide.additionalResources.memoryVerses.join(' • ')}</p>
                        </div>
                      )}
                      {studyGuide.additionalResources.prayerPoints && Array.isArray(studyGuide.additionalResources.prayerPoints) && studyGuide.additionalResources.prayerPoints.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{t('prayerPoints')}</h5>
                          <ul className="list-disc list-inside space-y-2">
                            {studyGuide.additionalResources.prayerPoints.map((point, i) => (
                              <li key={i} className="text-gray-700">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Commentaries Used */}
                {studyGuide.commentariesUsed && Array.isArray(studyGuide.commentariesUsed) && studyGuide.commentariesUsed.length > 0 && (
                  <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">{t('commentariesUsed')}</h4>
                    <div className="space-y-3">
                      {studyGuide.commentariesUsed.map((commentary, index) => (
                        <div key={index} className="bg-white p-3 rounded border border-gray-200">
                          <p className="text-gray-700">
                            <span className="font-semibold text-indigo-600">{typeof commentary.citation === 'string' ? commentary.citation : `[${index + 1}]`}</span>{' '}
                            <span className="font-medium">{typeof commentary.name === 'string' ? commentary.name : 'Commentary'}</span>{' '}
                            by <span className="italic">{typeof commentary.author === 'string' ? commentary.author : 'Unknown'}</span>
                          </p>
                          {commentary.url && typeof commentary.url === 'string' && (
                            <a href={commentary.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-1 block">
                              View source →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Prompt */}
                <div className="text-center py-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <p className="text-gray-700 mb-3">
                    {t('downloadPrompt')}
                  </p>
                  <button
                    onClick={exportToPDF}
                    className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    {i18n.language === 'zh' ? '导出PDF' : 'Export PDF'}
                  </button>
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