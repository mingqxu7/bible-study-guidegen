import React from 'react';
import { X, Trash2, Clock, BookOpen, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Slide-in drawer showing saved study history.
 *
 * Props:
 *   open            – boolean
 *   onClose         – callback
 *   history         – array of history entries
 *   onRestore       – (entry) => void   — restore a study
 *   onDelete        – (id) => void
 *   onClearAll      – () => void
 *   darkMode        – boolean
 */
const HistoryDrawer = ({ open, onClose, history, onRestore, onDelete, onClearAll, darkMode }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  if (!open) return null;

  const bg = darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const cardBg = darkMode ? 'bg-gray-800 hover:bg-gray-750 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200';
  const mutedText = darkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer panel */}
      <div className={`fixed top-0 right-0 z-50 h-full w-80 sm:w-96 shadow-2xl transform transition-transform duration-300 ${bg} flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {isZh ? '学习历史' : 'Study History'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className={`text-center py-12 ${mutedText}`}>
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>{isZh ? '尚无保存的学习指南' : 'No saved study guides yet'}</p>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${cardBg}`}
                onClick={() => { onRestore(entry); onClose(); }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{entry.passage || entry.title}</p>
                    <p className={`text-xs ${mutedText} mt-1`}>
                      {entry.theologyId} · {new Date(entry.savedAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500 transition-colors flex-shrink-0 ml-2"
                    title={isZh ? '删除' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className={`px-4 py-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => {
                if (window.confirm(isZh ? '确定清除所有历史记录？' : 'Clear all history?')) {
                  onClearAll();
                }
              }}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              {isZh ? '清除所有历史' : 'Clear All History'}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default HistoryDrawer;
