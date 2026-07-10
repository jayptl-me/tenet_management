'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function DarkModeToggle({ className }: { className?: string }) {
  const { theme, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className={`inline-flex items-center justify-center rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-2 transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:bg-[color:var(--color-surface-100)] ${className ?? ''}`}
      title={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme.mode === 'dark' ? (
        <Sun className="h-5 w-5 text-[color:var(--color-warning-500)]" />
      ) : (
        <Moon className="h-5 w-5 text-[color:var(--color-surface-600)]" />
      )}
    </button>
  );
}
