import React, { useState } from 'react';
import { History, Trash2, ChevronRight, Clock, X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const StudyHistoryPanel = ({ history, onSelect, onRemove, onClear }) => {
  const { t, i18n } = useTranslation();
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">{i18n.language === 'zh' ? '暂无历史记录' : 'No study guides yet'}</p>
        <p className="text-xs mt-1 opacity-75">{i18n.language === 'zh' ? '生成的学习指南将显示在此处' : 'Generated study guides will appear here'}</p>
      </div>
    );
  }

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return i18n.language === 'zh' ? '刚刚' : 'Just now';
    }
    if (diffHours < 24) {
      return i18n.language === 'zh' ? `${diffHours}小时前` : `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return i18n.language === 'zh' ? `${diffDays}天前` : `${diffDays}d ago`;
    }
    return date.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" />
          {i18n.language === 'zh' ? '历史记录' : 'History'}
          <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-1.5 py-0.5 rounded-full">
            {history.length}
          </span>
        </h3>
        {history.length > 0 && (
          <button
            onClick={() => setShowConfirmClear(true)}
            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            title={i18n.language === 'zh' ? '清除全部' : 'Clear all'}
          >
            {i18n.language === 'zh' ? '清除全部' : 'Clear all'}
          </button>
        )}
      </div>

      {showConfirmClear && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-300">
                {i18n.language === 'zh' ? '确定删除所有历史记录吗？此操作不可撤销。' : 'Delete all history? This cannot be undone.'}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { onClear(); setShowConfirmClear(false); }}
                  className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  {i18n.language === 'zh' ? '确认删除' : 'Delete all'}
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {i18n.language === 'zh' ? '取消' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="group relative p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"
            onClick={() => onSelect(entry)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {entry.passage}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded">
                    {entry.theology}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title={i18n.language === 'zh' ? '删除' : 'Delete'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudyHistoryPanel;
