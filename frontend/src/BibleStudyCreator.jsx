import React, { useState } from 'react';
import { Book, Search, Download, Users, Cross, MessageSquare } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001/api';

const BibleStudyCreator = () => {
  const [selectedTheology, setSelectedTheology] = useState('');
  const [verseInput, setVerseInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [error, setError] = useState('');

  const theologicalStances = [
    { 
      id: 'calvinism', 
      name: 'Reformed/Calvinist', 
      description: 'Emphasizes God\'s sovereignty, predestination, and the doctrines of grace',
      commentaries: ['Calvin\'s Commentary', 'Matthew Henry', 'John Gill', 'Charles Spurgeon', 'Barnes\' Notes']
    },
    { 
      id: 'arminianism', 
      name: 'Arminian/Wesleyan', 
      description: 'Emphasizes free will, conditional election, and the possibility of falling from grace',
      commentaries: ['Wesley\'s Notes', 'Clarke\'s Commentary', 'Benson\'s Commentary', 'Whedon\'s Commentary']
    },
    { 
      id: 'dispensationalism', 
      name: 'Dispensationalist', 
      description: 'Emphasizes distinct dispensations and literal interpretation of prophecy',
      commentaries: ['Scofield\'s Notes', 'Darby\'s Synopsis', 'Ironside\'s Notes', 'McGee\'s Commentary']
    },
    { 
      id: 'lutheranism', 
      name: 'Lutheran', 
      description: 'Emphasizes justification by faith alone and sacramental theology',
      commentaries: ['Kretzmann\'s Commentary', 'Bengel\'s Gnomon', 'Luther\'s Commentary']
    },
    { 
      id: 'catholicism', 
      name: 'Catholic', 
      description: 'Emphasizes church tradition, papal authority, and sacramental life',
      commentaries: ['Haydock\'s Commentary', 'Lapide\'s Commentary', 'Orchard\'s Commentary']
    }
  ];

  const generateStudyGuide = async () => {
    if (!selectedTheology || !verseInput.trim()) {
      setError('Please select a theological stance and enter Bible verses.');
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
          theologicalStances
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
      setError(error.message || 'Failed to generate study guide. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadStudyGuide = () => {
    if (!studyGuide) return;

    const content = `BIBLE STUDY GUIDE
${studyGuide.title}
Passage: ${studyGuide.passage}
Theological Perspective: ${studyGuide.theology}

===========================================

OVERVIEW

Introduction:
${studyGuide.overview.introduction}

Historical Context:
${studyGuide.overview.historicalContext}

Literary Context:
${studyGuide.overview.literaryContext}

===========================================

VERSE-BY-VERSE EXEGESIS

${studyGuide.exegesis.map(verse => `
${verse.verse}: ${verse.text || ''}

Explanation:
${verse.explanation}

Key Insights:
${verse.keyInsights.map(insight => `• ${insight}`).join('\n')}

Cross References:
${verse.crossReferences.join(', ')}
`).join('\n---\n')}

===========================================

DISCUSSION QUESTIONS

${studyGuide.discussionQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

===========================================

LIFE APPLICATION

Practical Applications:
${studyGuide.lifeApplication.practicalApplications.map(app => `• ${app}`).join('\n')}

Reflection Points:
${studyGuide.lifeApplication.reflectionPoints.map(point => `• ${point}`).join('\n')}

Action Steps:
${studyGuide.lifeApplication.actionSteps.map(step => `• ${step}`).join('\n')}

===========================================

ADDITIONAL RESOURCES

Cross References:
${studyGuide.additionalResources.crossReferences.join(', ')}

Memory Verses:
${studyGuide.additionalResources.memoryVerses.join(', ')}

Prayer Points:
${studyGuide.additionalResources.prayerPoints.map(point => `• ${point}`).join('\n')}

===========================================

COMMENTARIES USED

${studyGuide.commentariesUsed && studyGuide.commentariesUsed.length > 0 
  ? studyGuide.commentariesUsed.map(c => `${c.citation} ${c.name} by ${c.author}${c.url ? '\n    ' + c.url : ''}`).join('\n\n')
  : 'No specific commentaries cited - general theological knowledge used'}

===========================================
Generated by Bible Study Guide Generator`;

    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const filename = `${studyGuide.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Study_Guide.txt`;
      
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
            <h1 className="text-4xl font-bold text-gray-800">Bible Study Guide Generator</h1>
            <Book className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Generate comprehensive, theologically-informed Bible study guides for your cell group ministry
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Study Configuration
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Your Theological Perspective:
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
                          Commentaries: {stance.commentaries.slice(0, 3).join(', ')}
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
                Bible Passage:
              </label>
              <input
                type="text"
                value={verseInput}
                onChange={(e) => setVerseInput(e.target.value)}
                placeholder="e.g., Matthew 5:1-12, John 3:16, Romans 8:28-39"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the passage you want to study (book, chapter, and verses)
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
                  Generating Study Guide...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Generate Study Guide
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
                Study Guide
              </h2>
              {studyGuide && (
                <button
                  onClick={downloadStudyGuide}
                  className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>

            {!studyGuide && !isGenerating && (
              <div className="text-center py-12 text-gray-500">
                <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Configure your study settings and generate a comprehensive Bible study guide</p>
              </div>
            )}

            {studyGuide && (
              <div className="space-y-6 max-h-96 overflow-y-auto">
                <div className="text-center border-b pb-4">
                  <h3 className="text-xl font-bold text-gray-800">{studyGuide.title}</h3>
                  <p className="text-indigo-600 font-medium">{studyGuide.passage}</p>
                  <p className="text-sm text-gray-600">{studyGuide.theology} Perspective</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Overview</h4>
                  <div className="text-sm text-gray-700 space-y-2">
                    <p><strong>Introduction:</strong> {studyGuide.overview.introduction}</p>
                    <p><strong>Historical Context:</strong> {studyGuide.overview.historicalContext}</p>
                    <p><strong>Literary Context:</strong> {studyGuide.overview.literaryContext}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Verse-by-Verse Exegesis</h4>
                  <div className="space-y-3">
                    {studyGuide.exegesis.slice(0, 2).map((verse, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <p className="font-medium text-indigo-600">{verse.verse}</p>
                        <p className="text-sm text-gray-700 mt-1">{verse.explanation.substring(0, 200)}...</p>
                      </div>
                    ))}
                    {studyGuide.exegesis.length > 2 && (
                      <p className="text-sm text-gray-500 italic">
                        And {studyGuide.exegesis.length - 2} more verses...
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Discussion Questions</h4>
                  <div className="space-y-2">
                    {studyGuide.discussionQuestions.slice(0, 3).map((question, index) => (
                      <p key={index} className="text-sm text-gray-700">
                        {index + 1}. {question}
                      </p>
                    ))}
                    {studyGuide.discussionQuestions.length > 3 && (
                      <p className="text-sm text-gray-500 italic">
                        And {studyGuide.discussionQuestions.length - 3} more questions...
                      </p>
                    )}
                  </div>
                </div>

                {studyGuide.commentariesUsed && studyGuide.commentariesUsed.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Commentaries Used</h4>
                    <div className="space-y-1">
                      {studyGuide.commentariesUsed.map((commentary, index) => (
                        <div key={index} className="text-sm text-gray-700">
                          <p>
                            <span className="font-medium text-indigo-600">{commentary.citation}</span> {commentary.name} by {commentary.author}
                          </p>
                          {commentary.url && (
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
                    Download the complete study guide for full content
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Cross className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Theologically Aligned</h3>
            <p className="text-gray-600 text-sm">
              Choose from major theological perspectives to ensure your study guide aligns with your church's beliefs
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Book className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Comprehensive Analysis</h3>
            <p className="text-gray-600 text-sm">
              Verse-by-verse exegesis drawing from respected commentaries and biblical scholarship
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <Users className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Group-Ready</h3>
            <p className="text-gray-600 text-sm">
              Thought-provoking questions and practical applications designed for cell group discussions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleStudyCreator;