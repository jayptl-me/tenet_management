'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Megaphone,
  AlertTriangle,
  CreditCard,
  Check,
  MessageSquare,
  Wrench,
  Zap,
  Waves,
  Utensils,
  Users,
  Building2,
  DoorOpen,
  User,
  Copy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection } from '@/components/ui/FormSection';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';
import { toast } from 'sonner';
import type { INotificationType } from '@pg/types';

type TargetFilter = 'all' | 'floor' | 'room' | 'individual';

const typeIcons: Record<INotificationType, React.ReactNode> = {
  announcement: <Megaphone className="h-4 w-4" />,
  emergency: <AlertTriangle className="h-4 w-4 text-[color:var(--color-danger-500)]" />,
  payment_reminder: <CreditCard className="h-4 w-4 text-[color:var(--color-warning-500)]" />,
  payment_verified: <Check className="h-4 w-4 text-[color:var(--color-success-500)]" />,
  complaint_update: <MessageSquare className="h-4 w-4" />,
  service_update: <Wrench className="h-4 w-4" />,
  electricity_bill: <Zap className="h-4 w-4" />,
  welcome: <Waves className="h-4 w-4" />,
  meal_feedback: <Utensils className="h-4 w-4" />,
};

const typeOptions: { value: INotificationType; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'complaint_update', label: 'Complaint Update' },
  { value: 'service_update', label: 'Service Update' },
  { value: 'electricity_bill', label: 'Electricity Bill' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'meal_feedback', label: 'Meal Feedback' },
];

const targetLabels: Record<TargetFilter, string> = {
  all: 'All Tenants',
  floor: 'By Floor',
  room: 'By Room',
  individual: 'Specific Tenant',
};

const targetIcons: Record<TargetFilter, React.ReactNode> = {
  all: <Users className="h-4 w-4" />,
  floor: <Building2 className="h-4 w-4" />,
  room: <DoorOpen className="h-4 w-4" />,
  individual: <User className="h-4 w-4" />,
};

export default function NewNotificationPage() {
  const router = useRouter();
  const [targetType, setTargetType] = useState<TargetFilter>('all');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<INotificationType>('announcement');
  const [sendPush, setSendPush] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setSubmitError('');
    setSendSuccess(false);
    try {
      await api
        .post('notifications', {
          json: {
            targetType,
            targetIds: targetType !== 'all' ? targetIds : [],
            title: title.trim(),
            body: body.trim(),
            type,
            sendPush,
          },
        })
        .json<{ success: boolean }>();
      setSendSuccess(true);
      setTimeout(() => router.push('/notifications'), 1000);
    } catch {
      setSubmitError('Failed to send notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <FormPage
      title="Compose Notification"
      description="Send a notification to tenants"
      backHref="/notifications"
      error={submitError}
      maxWidth="3xl"
    >
      {sendSuccess && (
        <div className="mb-4 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-success-500)] bg-[color:var(--color-success-100)] p-4 text-sm font-semibold text-[color:var(--color-success-800)]">
          Notification sent successfully! Redirecting...
        </div>
      )}

      <FormCard
        onSubmit={handleSend}
        footer={
          <FormActions
            loading={sending}
            cancelHref="/notifications"
            submitLabel={sendSuccess ? 'Sent!' : 'Send Notification'}
            submitIcon={<Send className="h-4 w-4" />}
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <FormSection title="Target Audience">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(targetLabels) as TargetFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTargetType(key);
                    setTargetIds([]);
                  }}
                  className={`font-[family:var(--font-body)] flex items-center justify-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] ${
                    targetType === key
                      ? 'bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-button)]'
                      : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                  }`}
                >
                  {targetIcons[key]}
                  {targetLabels[key]}
                </button>
              ))}
            </div>
          </FormSection>

          {targetType !== 'all' && (
            <div>
              <Input
                label={
                  targetType === 'floor'
                    ? 'Floor IDs'
                    : targetType === 'room'
                      ? 'Room IDs'
                      : 'User IDs'
                }
                hint="comma-separated"
                value={targetIds.join(', ')}
                onChange={(e) =>
                  setTargetIds(
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="e.g. floor-1, floor-2"
              />
            </div>
          )}

          <FormSection title="Notification Type" divided>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`font-[family:var(--font-body)] flex items-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] ${
                    type === opt.value
                      ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)] shadow-[var(--shadow-button)]'
                      : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                  }`}
                >
                  {typeIcons[opt.value]}
                  {opt.label}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection title="Message" divided>
            <div className="space-y-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Notification title..."
                required
              />

              <div>
                <Textarea
                  id="notif-body"
                  label="Message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Notification message..."
                  required
                />
                <p className="font-[family:var(--font-mono)] mt-1 text-right text-xs text-[color:var(--color-text-muted)]">
                  {body.length}/2000
                </p>

                {type === 'emergency' &&
                  (() => {
                    const whatsappUrl = generateWhatsAppUrl('', `EMERGENCY: ${title}\n${body}`);
                    return (
                      <div className="mt-3 rounded-lg border-[length:var(--bw-default)] border-[color:var(--color-warning-500)] bg-[color:var(--color-warning-50)] p-4">
                        <p className="font-[family:var(--font-body)] mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-secondary)]">
                          WhatsApp Share Preview
                        </p>
                        <div className="flex items-center gap-2">
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-[family:var(--font-mono)] flex-1 truncate text-xs text-[color:var(--color-brand-600)] underline"
                          >
                            {whatsappUrl}
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                              copyToClipboard(whatsappUrl);
                              toast.success('WhatsApp link copied to clipboard');
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy link
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
              </div>

              <Checkbox
                label="Send push notification via ntfy.sh"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
              />
            </div>
          </FormSection>
        </div>
      </FormCard>
    </FormPage>
  );
}
