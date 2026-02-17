import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bible-study-history';
const MAX_HISTORY = 50;

export function useStudyHistory() {
  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist whenever history changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // localStorage full – silently drop
    }
  }, [history]);

  /** Save a study guide. Uses theologyId (not translated name) for locale-safe restore. */
  const saveStudy = useCallback((studyGuide, theologyId, selectedCommentaries) => {
    if (!studyGuide) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      theologyId,                       // locale-safe key
      passage: studyGuide.passage || '',
      title: studyGuide.title || '',
      selectedCommentaries: selectedCommentaries || {},
      studyGuide,                       // full payload
    };

    setHistory((prev) => {
      const next = [entry, ...prev];
      return next.slice(0, MAX_HISTORY);
    });
    return entry.id;
  }, []);

  const deleteStudy = useCallback((id) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, saveStudy, deleteStudy, clearHistory };
}
