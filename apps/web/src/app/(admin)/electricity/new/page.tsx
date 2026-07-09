'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { roomLabel } from '@/lib/resource-select-presets';

interface RoomOption {
  _id: string;
  roomNumber: string;
  sharingType?: number;
  monthlyRent?: number;
}

interface RoomEntryForm {
  roomId: string;
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function NewElectricityPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [totalBillAmount, setTotalBillAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [entries, setEntries] = useState<RoomEntryForm[]>([
    { roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 },
  ]);

  useEffect(() => {
    api
      .get('rooms?limit=100&isActive=true')
      .json<{ success: boolean; data: RoomOption[] }>()
      .then((res) => setRooms(res.data ?? []))
      .catch(() => setRooms([]));
  }, []);

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 },
    ]);
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const updateEntry = (idx: number, patch: Partial<RoomEntryForm>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!/^\d{4}-\d{2}$/.test(month)) {
      setSubmitError('Month must be YYYY-MM');
      return;
    }
    if (entries.some((en) => !en.roomId)) {
      setSubmitError('Select a room for every entry');
      return;
    }
    if (entries.some((en) => en.currentReading < en.previousReading)) {
      setSubmitError('Current reading must be >= previous reading for all rooms');
      return;
    }
    const roomIds = entries.map((en) => en.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      setSubmitError('Each room can only appear once');
      return;
    }

    setIsSubmitting(true);
    try {
      await api
        .post('electricity', {
          json: {
            month,
            totalBillAmount,
            notes: notes || undefined,
            roomEntries: entries.map((en) => ({
              roomId: en.roomId,
              previousReading: en.previousReading,
              currentReading: en.currentReading,
              ratePerUnit: en.ratePerUnit,
            })),
          },
        })
        .json<{ success: boolean }>();
      router.push('/electricity');
    } catch {
      setSubmitError(
        'Failed to create bill. A bill for this month may already exist, or validation failed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomOptions = rooms.map((r) => ({
    value: r._id,
    label: roomLabel(r),
  }));

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            New Electricity Bill
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Monthly bill with per-room meter readings
          </p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Month"
            placeholder="YYYY-MM"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Input
            label="Total Bill Amount (₹)"
            type="number"
            min={0}
            step="0.01"
            value={totalBillAmount}
            onChange={(e) => setTotalBillAmount(Number(e.target.value))}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-[color:var(--color-text-primary)]">
              Room Readings
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addEntry}>
              <Plus className="h-4 w-4" /> Add Room
            </Button>
          </div>
          <div className="space-y-4">
            {entries.map((entry, idx) => {
              const units = Math.max(0, entry.currentReading - entry.previousReading);
              const amount = units * entry.ratePerUnit;
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
                      Entry {idx + 1}
                    </span>
                    {entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEntry(idx)}
                        className="text-[color:var(--color-danger-600)]"
                        aria-label="Remove entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                        Room
                      </label>
                      <select
                        className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm"
                        value={entry.roomId}
                        onChange={(e) => updateEntry(idx, { roomId: e.target.value })}
                        required
                      >
                        <option value="">Select room...</option>
                        {roomOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Previous reading"
                      type="number"
                      min={0}
                      value={entry.previousReading}
                      onChange={(e) =>
                        updateEntry(idx, { previousReading: Number(e.target.value) })
                      }
                    />
                    <Input
                      label="Current reading"
                      type="number"
                      min={0}
                      value={entry.currentReading}
                      onChange={(e) =>
                        updateEntry(idx, { currentReading: Number(e.target.value) })
                      }
                    />
                    <Input
                      label="Rate / unit (₹)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={entry.ratePerUnit}
                      onChange={(e) =>
                        updateEntry(idx, { ratePerUnit: Number(e.target.value) })
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                    Units: {units} · Amount: ₹{amount.toLocaleString('en-IN')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="notes"
            className="text-sm font-semibold text-[color:var(--color-text-primary)]"
          >
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            className="w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-2.5 text-base"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Bill
          </Button>
        </div>
      </form>
    </div>
  );
}
