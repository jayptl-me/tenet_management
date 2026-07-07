'use client';

import { useState } from 'react';
import { AlertTriangle, Send, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export function EmergencyAlertButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('notifications', {
        json: {
          targetType: 'all',
          targetIds: [],
          title: `[EMERGENCY] ${title}`,
          body,
          type: 'emergency',
          sendPush: true,
        },
      }).json();
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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-danger-500 hover:bg-danger-600 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-3 py-1.5 font-display text-xs font-bold text-white shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] active:scale-[var(--active-press-scale)]"
        title="Send Emergency Alert"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="hidden sm:inline">Emergency</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-modal)]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-danger-100 flex h-10 w-10 items-center justify-center rounded-full border-[length:var(--bw-default)] border-[color:var(--color-danger-300)]">
                  <AlertTriangle className="text-danger-600 h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-surface-900 text-lg font-bold">Emergency Alert</h3>
                  <p className="text-surface-500 text-sm">
                    This will notify ALL tenants immediately via push + in-app
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-surface-400 hover:text-surface-600 rounded-md p-1 transition-colors"
                disabled={sending}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="border-danger-500 bg-danger-100 text-danger-800 mt-4 rounded-[var(--radius-md)] border-[length:var(--bw-default)] p-3 text-sm font-semibold">
                {error}
              </div>
            )}

            {sent ? (
              <div className="border-success-500 bg-success-100 text-success-800 mt-4 rounded-[var(--radius-md)] border-[length:var(--bw-default)] p-4 text-center">
                <p className="font-display text-lg font-bold">Alert Sent!</p>
                <p className="text-sm">All tenants and guardians have been notified.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="font-body text-surface-700 mb-1 block text-sm font-semibold">
                    Alert Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Fire Drill — Exit Immediately"
                    className="font-body focus:border-danger-500 w-full rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-4 py-2.5 text-sm focus:outline-none"
                    maxLength={150}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="font-body text-surface-700 mb-1 block text-sm font-semibold">
                    Message
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Describe the emergency and what tenants should do..."
                    rows={3}
                    className="font-body focus:border-danger-500 w-full resize-none rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-4 py-2.5 text-sm focus:outline-none"
                    maxLength={500}
                  />
                </div>
              </div>
            )}

            {!sent && (
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="font-body text-surface-600 hover:text-surface-800 rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-colors"
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !title.trim() || !body.trim()}
                  className="bg-danger-500 hover:bg-danger-600 inline-flex items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-5 py-2.5 font-display text-sm font-bold text-white shadow-[var(--shadow-button)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] disabled:cursor-not-allowed disabled:opacity-50"
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
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
