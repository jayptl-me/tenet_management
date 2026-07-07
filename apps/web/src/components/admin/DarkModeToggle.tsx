'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function DarkModeToggle({ className }: { className?: string }) {
  const { theme, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className={`hover:bg-surface-100 inline-flex items-center justify-center rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] p-2 transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] ${className ?? ''}`}
      title={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme.mode === 'dark' ? (
        <Sun className="text-warning-500 h-5 w-5" />
      ) : (
        <Moon className="text-surface-600 h-5 w-5" />
      )}
    </button>
  );
}
