import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bible-study-dark-mode';

/**
 * Hook to manage dark mode with system preference detection.
 * Returns [isDark, toggleDark]
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, String(isDark));
  }, [isDark]);

  // Listen to system preference changes
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => {
      // Only update if user hasn't explicitly set a preference
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        setIsDark(e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleDark = () => setIsDark((prev) => !prev);

  return [isDark, toggleDark];
}
