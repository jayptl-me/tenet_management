'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Sun,
  Sunset,
  Moon,
  MessageCircle,
  Pencil,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface MenuMealItem {
  name: string;
  description?: string;
  category?: string;
}

interface MenuDetail {
  _id: string;
  date: string;
  meals: {
    breakfast: MenuMealItem[];
    lunch: MenuMealItem[];
    dinner: MenuMealItem[];
  };
  isActive: boolean;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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
      .then((res) => setMenu(res.data))
      .catch(() => setError('Failed to load menu'))
      .finally(() => setIsLoading(false));
  }, [id]);

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !menu) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Menu not found'}</p>
        </div>
      </div>
    );
  }

  const dateDisplay = formatDate(menu.date);
  const statusVariant = menu.isActive ? statusToVariant('active') : statusToVariant('draft');
  const statusLabel = menu.isActive ? 'Active' : 'Draft';

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Daily Menu</h2>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              <Calendar className="h-3.5 w-3.5" />{dateDisplay}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={statusVariant} label={statusLabel} />
          <Button variant="outline" size="icon" onClick={() => router.push(`/menus/${menu._id}/edit`)} title="Edit menu">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Meal Cards ──────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {([
          { key: 'breakfast' as const, icon: Sun, iconBg: 'bg-[color:var(--color-warning-100)]', iconColor: 'text-[color:var(--color-warning-600)]' },
          { key: 'lunch' as const, icon: Sunset, iconBg: 'bg-[color:var(--color-brand-100)]', iconColor: 'text-[color:var(--color-brand-600)]' },
          { key: 'dinner' as const, icon: Moon, iconBg: 'bg-[color:var(--color-surface-800)]', iconColor: 'text-[color:var(--color-surface-200)]' },
        ]).map(({ key, icon: Icon, iconBg, iconColor }) => {
          const items = menu.meals?.[key] ?? [];
          return (
            <div key={key} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--border-color)] ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <h3 className="text-lg font-bold capitalize text-[color:var(--color-text-primary)]">{key}</h3>
              </div>
              {items.length === 0 ? (
                <p className="italic text-sm text-[color:var(--color-text-muted)]">Not set</p>
              ) : (
                <ul className="space-y-2.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      <span className="font-semibold text-[color:var(--color-text-primary)]">{item.name}</span>
                      {item.description && (
                        <span className="ml-1.5 text-xs text-[color:var(--color-text-muted)]">— {item.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* ── Actions ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => {
              const phone = process.env.NEXT_PUBLIC_PG_PHONE ?? '';
              const formatItems = (items: MenuMealItem[]) =>
                items.length === 0 ? 'Not set' : items.map((it) => it.name).join(', ');
              const text = [
                `Menu for ${dateDisplay}:`,
                `Breakfast: ${formatItems(menu.meals?.breakfast ?? [])}`,
                `Lunch: ${formatItems(menu.meals?.lunch ?? [])}`,
                `Dinner: ${formatItems(menu.meals?.dinner ?? [])}`,
              ].join('\n');
              const url = generateWhatsAppUrl(phone, text);
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            <MessageCircle className="h-4 w-4" /> Share via WhatsApp
          </Button>
          <Button variant="outline" onClick={() => router.push(`/menus/${menu._id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit Menu
          </Button>
        </div>
      </motion.div>

      {/* ── Meta ────────────────────────────────── */}
      <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
        Created {new Date(menu.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </p>
    </motion.div>
  );
}
