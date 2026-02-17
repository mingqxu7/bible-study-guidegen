import React, { useState, useRef } from 'react';
import { X, ChevronDown, ChevronUp, Printer, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Full-screen modal showing every field of a study guide with expandable verse sections.
 *
 * Props:
 *   studyGuide   – the full guide object
 *   onClose      – callback to close the modal
 *   onExportMd   – callback to export Markdown (receives studyGuide)
 *   darkMode     – boolean
 */
const FullStudyGuideView = ({ studyGuide, onClose, onExportMd, darkMode }) => {
  const { t, i18n } = useTranslation();
  const [expandedVerses, setExpandedVerses] = useState({});
  const modalContentRef = useRef(null);

  if (!studyGuide) return null;

  const toggleVerse = (idx) =>
    setExpandedVerses((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const expandAll = () => {
    if (!studyGuide.exegesis) return;
    const all = {};
    studyGuide.exegesis.forEach((_, i) => (all[i] = true));
    setExpandedVerses(all);
  };
  const collapseAll = () => setExpandedVerses({});

  const bg = darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const cardBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const mutedText = darkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="modal fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative w-full max-w-4xl mx-4 my-8 rounded-xl shadow-2xl ${bg} print-modal-content`}
        ref={modalContentRef}
      >
        {/* Sticky header bar */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b rounded-t-xl ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className="text-xl font-bold truncate pr-4">{studyGuide.title || studyGuide.passage}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => window.print()} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors no-print" title="Print">
              <Printer className="w-5 h-5" />
            </button>
            {onExportMd && (
              <button onClick={() => onExportMd(studyGuide)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors no-print" title="Export Markdown">
                <FileText className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors no-print" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Passage & Theology */}
          <div className="text-center">
            <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{studyGuide.passage}</p>
            <p className={`text-sm ${mutedText}`}>{studyGuide.theology} {t('perspective')}</p>
          </div>

          {/* Overview */}
          {studyGuide.overview && (
            <Section title={t('overview')} darkMode={darkMode}>
              <Field label={t('introduction')} value={studyGuide.overview.introduction} darkMode={darkMode} />
              <Field label={t('historicalContext')} value={studyGuide.overview.historicalContext} darkMode={darkMode} />
              <Field label={t('literaryContext')} value={studyGuide.overview.literaryContext} darkMode={darkMode} />
            </Section>
          )}

          {/* Exegesis */}
          {studyGuide.exegesis && studyGuide.exegesis.length > 0 && (
            <Section title={t('exegesis')} darkMode={darkMode}
              extra={
                <div className="flex gap-2 no-print">
                  <button onClick={expandAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    {i18n.language === 'zh' ? '展开全部' : 'Expand All'}
                  </button>
                  <span className={mutedText}>|</span>
                  <button onClick={collapseAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    {i18n.language === 'zh' ? '折叠全部' : 'Collapse All'}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                {studyGuide.exegesis.map((verse, idx) => {
                  const open = expandedVerses[idx] ?? false;
                  return (
                    <div key={idx} className={`border rounded-lg overflow-hidden ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <button
                        className={`w-full flex items-center justify-between px-4 py-3 text-left font-semibold ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
                        onClick={() => toggleVerse(idx)}
                      >
                        <span className="text-indigo-600 dark:text-indigo-400">{verse.verse}</span>
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {open && (
                        <div className={`px-4 pb-4 space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                          {verse.text && (
                            <blockquote className={`italic border-l-4 pl-3 py-1 ${darkMode ? 'border-indigo-500 text-gray-300' : 'border-indigo-300 text-gray-600'}`}>
                              "{verse.text}"
                            </blockquote>
                          )}
                          <p className="leading-relaxed">{verse.explanation}</p>
                          {verse.keyInsights && verse.keyInsights.length > 0 && (
                            <div>
                              <h6 className="font-semibold mb-1">{t('keyInsights')}</h6>
                              <ul className="list-disc list-inside space-y-1">
                                {verse.keyInsights.map((ins, i) => <li key={i}>{ins}</li>)}
                              </ul>
                            </div>
                          )}
                          {verse.verbatimQuotes && verse.verbatimQuotes.length > 0 && (
                            <div>
                              <h6 className="font-semibold mb-1">{t('commentaryQuotes') || 'Commentary Quotes'}</h6>
                              {verse.verbatimQuotes.map((q, i) => (
                                <div key={i} className={`border-l-4 pl-3 py-2 mb-2 ${darkMode ? 'border-indigo-500 bg-gray-700' : 'border-indigo-400 bg-white'} rounded-r`}>
                                  <p className="italic">"{q.quote}"</p>
                                  <p className={`text-sm ${mutedText}`}>— {q.author}, <em>{q.commentary}</em></p>
                                </div>
                              ))}
                            </div>
                          )}
                          {verse.crossReferences && verse.crossReferences.length > 0 && (
                            <div>
                              <h6 className="font-semibold mb-1">{t('crossReferences')}</h6>
                              <p className={`text-sm ${mutedText}`}>{verse.crossReferences.join(' • ')}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Discussion Questions */}
          {studyGuide.discussionQuestions && studyGuide.discussionQuestions.length > 0 && (
            <Section title={t('discussionQuestions')} darkMode={darkMode}>
              <ol className="list-decimal list-inside space-y-2">
                {studyGuide.discussionQuestions.map((q, i) => (
                  <li key={i} className="leading-relaxed">{q}</li>
                ))}
              </ol>
            </Section>
          )}

          {/* Life Application */}
          {studyGuide.lifeApplication && (
            <Section title={t('lifeApplication')} darkMode={darkMode}>
              {studyGuide.lifeApplication.practicalApplications?.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-1">{t('practicalApplications')}</h5>
                  <ul className="list-disc list-inside space-y-1">
                    {studyGuide.lifeApplication.practicalApplications.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              {studyGuide.lifeApplication.reflectionPoints?.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-1">{t('reflectionPoints')}</h5>
                  <ul className="list-disc list-inside space-y-1">
                    {studyGuide.lifeApplication.reflectionPoints.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {studyGuide.lifeApplication.actionSteps?.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-1">{t('actionSteps')}</h5>
                  <ol className="list-decimal list-inside space-y-1">
                    {studyGuide.lifeApplication.actionSteps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              )}
            </Section>
          )}

          {/* Additional Resources */}
          {studyGuide.additionalResources && (
            <Section title={t('additionalResources')} darkMode={darkMode}>
              {studyGuide.additionalResources.crossReferences?.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-1">{t('crossReferences')}</h5>
                  <p>{studyGuide.additionalResources.crossReferences.join(' • ')}</p>
                </div>
              )}
              {studyGuide.additionalResources.memoryVerses?.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-1">{t('memoryVerses')}</h5>
                  <p>{studyGuide.additionalResources.memoryVerses.join(' • ')}</p>
                </div>
              )}
              {studyGuide.additionalResources.prayerPoints?.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-1">{t('prayerPoints')}</h5>
                  <ul className="list-disc list-inside space-y-1">
                    {studyGuide.additionalResources.prayerPoints.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Commentaries Used */}
          {studyGuide.commentariesUsed?.length > 0 && (
            <Section title={t('commentariesUsed')} darkMode={darkMode}>
              <div className="space-y-2">
                {studyGuide.commentariesUsed.map((c, i) => (
                  <div key={i} className={`p-3 rounded border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                    <p>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{c.citation}</span>{' '}
                      <span className="font-medium">{c.name}</span> by <em>{c.author}</em>
                    </p>
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View source →</a>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---- helper sub-components ---- */

function Section({ title, children, darkMode, extra }) {
  return (
    <div className={`rounded-lg border p-5 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <div className="w-1 h-5 bg-indigo-600 rounded" />
          {title}
        </h3>
        {extra}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, darkMode }) {
  if (!value) return null;
  return (
    <div>
      <h5 className="font-semibold mb-1">{label}</h5>
      <p className="leading-relaxed">{value}</p>
    </div>
  );
}

export default FullStudyGuideView;
