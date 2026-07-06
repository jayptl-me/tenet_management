'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Sun, Sunset, Moon } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

interface MenuDetail {
  _id: string;
  date: string;
  dayOfWeek?: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  isActive: boolean;
  createdAt: string;
}

export default function MenuDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [menu, setMenu] = useState<MenuDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`menus/${id}`)
      .json<{ success: boolean; data: MenuDetail }>()
      .then((res) => {
        setMenu(res.data);
      })
      .catch(() => {
        setError('Failed to load menu');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Menu not found'}
        </div>
      </div>
    );
  }

  const dateDisplay = new Date(menu.date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dayName =
    menu.dayOfWeek || new Date(menu.date).toLocaleDateString('en-IN', { weekday: 'long' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">Daily Menu</h2>
            <p className="text-surface-500 flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              {dateDisplay}
            </p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(menu.isActive ? 'active' : 'draft')}
          label={menu.isActive ? 'Active' : 'Draft'}
        />
      </div>

      {/* Meals */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Breakfast */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)]">
              <Sun className="text-warning-600 h-5 w-5" />
            </div>
            <h3 className="font-display text-surface-900 text-lg font-bold">Breakfast</h3>
          </div>
          <p className="text-surface-700 whitespace-pre-wrap text-sm leading-relaxed">
            {menu.breakfast || <span className="text-surface-400 italic">Not set</span>}
          </p>
        </div>

        {/* Lunch */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-brand-100 flex h-10 w-10 items-center justify-center rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)]">
              <Sunset className="text-brand-600 h-5 w-5" />
            </div>
            <h3 className="font-display text-surface-900 text-lg font-bold">Lunch</h3>
          </div>
          <p className="text-surface-700 whitespace-pre-wrap text-sm leading-relaxed">
            {menu.lunch || <span className="text-surface-400 italic">Not set</span>}
          </p>
        </div>

        {/* Dinner */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-surface-800 flex h-10 w-10 items-center justify-center rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)]">
              <Moon className="text-surface-200 h-5 w-5" />
            </div>
            <h3 className="font-display text-surface-900 text-lg font-bold">Dinner</h3>
          </div>
          <p className="text-surface-700 whitespace-pre-wrap text-sm leading-relaxed">
            {menu.dinner || <span className="text-surface-400 italic">Not set</span>}
          </p>
        </div>
      </div>

      {/* Meta */}
      <p className="text-surface-400 text-right text-xs">
        Day: {dayName} • Created{' '}
        {new Date(menu.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </p>
    </div>
  );
}
