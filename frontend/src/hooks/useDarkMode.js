import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bible-study-dark-mode';

/**
 * Hook to manage dark mode with system preference detection.
 * Returns [isDark, toggleDark]
 *
 * When the user has never explicitly toggled, the theme follows the OS
 * preference (including live changes). Once the user toggles, the choice
 * is persisted and system changes are ignored.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
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

  // Apply dark class to <html> whenever isDark changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Listen to system preference changes — only follow them when the user
  // hasn't set an explicit override (STORAGE_KEY absent from localStorage).
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        setIsDark(e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Explicit toggle — persists preference and stops following the OS
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return [isDark, toggleDark];
}
