'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Sun, Sunset, Moon, MessageCircle, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard } from '@/components/ui/DetailCard';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

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

  if (!isLoading && (error || !menu)) {
    return (
      <FormPage
        title="Daily Menu"
        description="View menu details"
        backHref="/menus"
        error={error || 'Menu not found'}
        maxWidth="4xl"
      />
    );
  }

  const dateDisplay = menu ? formatDate(menu.date) : '';
  const statusVariant = menu?.isActive ? statusToVariant('active') : statusToVariant('draft');
  const statusLabel = menu?.isActive ? 'Active' : 'Draft';

  return (
    <FormPage
      title="Daily Menu"
      description={menu ? dateDisplay : undefined}
      backHref="/menus"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={menu ? <StatusBadge variant={statusVariant} label={statusLabel} /> : undefined}
      actions={
        menu ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/menus/${menu._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {menu && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {(
              [
                { key: 'breakfast' as const, icon: <Sun /> },
                { key: 'lunch' as const, icon: <Sunset /> },
                { key: 'dinner' as const, icon: <Moon /> },
              ] as const
            ).map(({ key, icon }) => {
              const items = menu.meals?.[key] ?? [];
              return (
                <DetailCard
                  key={key}
                  title={key.charAt(0).toUpperCase() + key.slice(1)}
                  icon={icon}
                >
                  {items.length === 0 ? (
                    <p className="text-sm italic text-[color:var(--color-text-muted)]">Not set</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {items.map((item, i) => (
                        <li key={i} className="text-sm leading-relaxed">
                          <span className="font-semibold text-[color:var(--color-text-primary)]">
                            {item.name}
                          </span>
                          {item.description && (
                            <span className="ml-1.5 text-xs text-[color:var(--color-text-muted)]">
                              — {item.description}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailCard>
              );
            })}
          </div>

          <DetailCard title="Actions" icon={<MessageCircle />}>
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
          </DetailCard>

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            <Calendar className="mr-1 inline h-3 w-3" />
            Created{' '}
            {new Date(menu.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      )}
    </FormPage>
  );
}
