'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600">
        <span className="w-5 h-5 block"></span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="px-2 py-1 text-xs bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition"
      style={{ height: '28px', width: '28px' }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <span className="text-xs">☀️</span>
      ) : (
        <span className="text-xs">🌙</span>
      )}
    </button>
  );
}

