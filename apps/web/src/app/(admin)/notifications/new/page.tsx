'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Megaphone, AlertTriangle, CreditCard, Check, MessageSquare, Wrench, Zap, Waves, Utensils, Users, Building2, DoorOpen, User, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
      await api.post('notifications', {
        json: {
          targetType,
          targetIds: targetType !== 'all' ? targetIds : [],
          title: title.trim(),
          body: body.trim(),
          type,
          sendPush,
        },
      }).json<{ success: boolean }>();
      setSendSuccess(true);
      setTimeout(() => router.push('/notifications'), 1000);
    } catch {
      setSubmitError('Failed to send notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-[color:var(--color-surface-900)] text-2xl font-extrabold">
            Compose Notification
          </h2>
          <p className="text-[color:var(--color-surface-500)] mt-0.5 text-sm">
            Send a notification to tenants
          </p>
        </div>
      </div>

      {submitError && (
        <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}
      {sendSuccess && (
        <div className="border-[color:var(--color-success-500)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          Notification sent successfully! Redirecting...
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          {/* Target Audience */}
          <div>
            <label className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] mb-2 block text-sm font-semibold">
              Target Audience
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(targetLabels) as TargetFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTargetType(key); setTargetIds([]); }}
                  className={`font-[family:var(--font-body)] flex items-center justify-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] ${
                    targetType === key
                      ? 'bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-button)]'
                      : 'text-[color:var(--color-surface-600)] hover:bg-[color:var(--color-surface-50)] bg-[color:var(--color-surface-100)]'
                  }`}
                >
                  {targetIcons[key]}
                  {targetLabels[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Target IDs (for non-"all" targets) */}
          {targetType !== 'all' && (
            <div>
              <label className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] mb-2 block text-sm font-semibold">
                {targetType === 'floor'
                  ? 'Floor IDs'
                  : targetType === 'room'
                    ? 'Room IDs'
                    : 'User IDs'}
                <span className="text-[color:var(--color-surface-400)] ml-1 font-normal">(comma-separated)</span>
              </label>
              <Input
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

          {/* Notification Type */}
          <div>
            <label className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] mb-2 block text-sm font-semibold">
              Notification Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`font-[family:var(--font-body)] flex items-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] ${
                    type === opt.value
                      ? 'bg-[color:var(--color-surface-900)] text-white shadow-[var(--shadow-button)]'
                      : 'text-[color:var(--color-surface-600)] hover:bg-[color:var(--color-surface-50)] bg-[color:var(--color-surface-100)]'
                  }`}
                >
                  {typeIcons[opt.value]}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Notification title..."
            required
          />

          {/* Body */}
          <div>
            <label
              htmlFor="notif-body"
              className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] mb-2 block text-sm font-semibold"
            >
              Message
            </label>
            <textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Notification message..."
              required
              className="font-[family:var(--font-body)] focus:border-[color:var(--color-brand-500)] focus:ring-[color:var(--color-brand-200)] w-full resize-none rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-4 py-2.5 text-sm shadow-[var(--shadow-button)] focus:outline-none focus:ring-[length:var(--bw-default)]"
            />
            <p className="text-[color:var(--color-surface-400)] mt-1 text-right font-[family:var(--font-mono)] text-xs">
              {body.length}/2000
            </p>

            {/* WhatsApp Share Preview for Emergency */}
            {type === 'emergency' && (() => {
              const whatsappUrl = generateWhatsAppUrl('', `EMERGENCY: ${title}\n${body}`);
              return (
                <div className="border-[color:var(--color-warning-500)] bg-[color:var(--color-warning-50)] mt-3 rounded-lg border-[length:var(--bw-default)] p-4">
                  <p className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] mb-2 text-xs font-semibold uppercase tracking-wider">
                    WhatsApp Share Preview
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-[family:var(--font-mono)] text-[color:var(--color-brand-600)] flex-1 truncate text-xs underline"
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

          {/* Send Push Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="text-[color:var(--color-brand-500)] focus:ring-[color:var(--color-brand-300)] h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
              />
              <span className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] text-sm">
                Send push notification via ntfy.sh
              </span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={sending} disabled={!title.trim() || !body.trim()}>
            <Send className="h-4 w-4" />
            {sendSuccess ? 'Sent!' : 'Send Notification'}
          </Button>
        </div>
      </form>
    </div>
  );
}
