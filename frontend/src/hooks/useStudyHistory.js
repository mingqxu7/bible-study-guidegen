import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bible-study-history';
const MAX_HISTORY = 50;

/**
 * Hook to manage study guide history in localStorage.
 * Each entry: { id, passage, theology, language, createdAt, studyGuide }
 */
export function useStudyHistory() {
  const [history, setHistory] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load study history:', err);
    }
  }, []);

  // Persist to localStorage whenever history changes
  const persist = useCallback((newHistory) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (err) {
      console.error('Failed to persist study history:', err);
    }
  }, []);

  const addEntry = useCallback((studyGuide, passage, theology, language, theologyId) => {
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      passage,
      theology,
      theologyId: theologyId || theology,
      language,
      createdAt: new Date().toISOString(),
      studyGuide,
    };
    setHistory((prev) => {
      const updated = [entry, ...prev].slice(0, MAX_HISTORY);
      persist(updated);
      return updated;
    });
    return entry.id;
  }, [persist]);

  const removeEntry = useCallback((id) => {
    setHistory((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    persist([]);
  }, [persist]);

  const getEntry = useCallback((id) => {
    return history.find((e) => e.id === id) || null;
  }, [history]);

  return { history, addEntry, removeEntry, clearHistory, getEntry };
}
