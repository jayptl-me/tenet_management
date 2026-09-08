'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Send, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppConfigPublic } from '@/hooks/useAppConfig';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

export function EmergencyAlertButton() {
  const { data: appConfig } = useAppConfigPublic();
  const enabled = appConfig?.features?.emergencyAlertsEnabled !== false;
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, sending]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    if (!enabled) {
      setError('Emergency alerts are disabled in Settings.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api
        .post('notifications', {
          json: {
            targetType: 'all',
            targetIds: [],
            title: `[EMERGENCY] ${title}`,
            body,
            type: 'emergency',
            sendPush: true,
          },
        })
        .json();
      setSent(true);
      setTimeout(() => {
        setIsOpen(false);
        setSent(false);
        setTitle('');
        setBody('');
      }, 2000);
    } catch {
      setError('Failed to send. Try again.');
    } finally {
      setSending(false);
    }
  };

  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="font-display inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-danger-500)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-text-inverted)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:bg-[color:var(--color-danger-600)] active:scale-[var(--active-press-scale)]"
        title="Send Emergency Alert"
        aria-label="Send Emergency Alert"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="hidden sm:inline">Emergency</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-alert-title"
            aria-describedby="emergency-alert-desc"
            className="animate-fade-in-up mx-4 w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-[length:var(--bw-default)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-100)]">
                  <AlertTriangle className="h-5 w-5 text-[color:var(--color-danger-600)]" />
                </div>
                <div>
                  <h3
                    id="emergency-alert-title"
                    className="font-display text-lg font-bold text-[color:var(--color-surface-900)]"
                  >
                    Emergency Alert
                  </h3>
                  <p
                    id="emergency-alert-desc"
                    className="text-sm text-[color:var(--color-surface-500)]"
                  >
                    This will notify ALL tenants immediately via push + in-app
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-[color:var(--color-surface-400)] transition-colors hover:text-[color:var(--color-surface-600)]"
                disabled={sending}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-3 text-sm font-semibold text-[color:var(--color-danger-800)]">
                {error}
              </div>
            )}

            {sent ? (
              <div className="mt-4 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--color-success-500)] bg-[color:var(--color-success-100)] p-4 text-center text-[color:var(--color-success-800)]">
                <p className="font-display text-lg font-bold">Alert Sent!</p>
                <p className="text-sm">All active tenants have been notified immediately.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Input
                  id="emergency-alert-title-input"
                  label="Alert Title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Fire Drill -- Exit Immediately"
                  maxLength={150}
                  autoFocus
                />
                <Textarea
                  id="emergency-alert-body-input"
                  label="Message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe the emergency and what tenants should do..."
                  rows={3}
                  maxLength={500}
                />
              </div>
            )}

            {!sent && (
              <div className="mt-6 flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleSend()}
                  disabled={sending || !title.trim() || !body.trim()}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Emergency Alert
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
