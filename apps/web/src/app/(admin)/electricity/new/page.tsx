'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
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
    <FormPage
      title="New Electricity Bill"
      description="Monthly bill with per-room meter readings"
      backHref="/electricity"
      error={submitError}
      maxWidth="4xl"
    >
      <FormCard
        onSubmit={onSubmit}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/electricity"
            submitLabel="Save Bill"
            divided={false}
          />
        }
      >
        <FormSection
          title="Bill details"
          description="Billing month and total amount for this cycle"
        >
          <FormGrid>
            <Input
              label="Month"
              placeholder="YYYY-MM"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Input
              label="Total bill amount (₹)"
              type="number"
              min={0}
              step="0.01"
              value={totalBillAmount}
              onChange={(e) => setTotalBillAmount(Number(e.target.value))}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Room readings"
          description="Per-room meter readings for this billing period"
          divided
          action={
            <Button type="button" variant="outline" size="sm" onClick={addEntry}>
              <Plus className="h-4 w-4" /> Add room
            </Button>
          }
        >
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const units = Math.max(0, entry.currentReading - entry.previousReading);
              const amount = units * entry.ratePerUnit;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]"
                >
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                    <label
                      className="text-[13px] font-semibold text-[color:var(--color-text-primary)]"
                      htmlFor={`elec-new-room-${idx}`}
                    >
                      Room
                    </label>
                    <select
                      id={`elec-new-room-${idx}`}
                      className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)]"
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
                    label="Previous"
                    type="number"
                    min={0}
                    value={entry.previousReading}
                    onChange={(e) =>
                      updateEntry(idx, { previousReading: Number(e.target.value) })
                    }
                  />
                  <Input
                    label="Current"
                    type="number"
                    min={0}
                    value={entry.currentReading}
                    onChange={(e) =>
                      updateEntry(idx, { currentReading: Number(e.target.value) })
                    }
                  />
                  <Input
                    label="Rate / unit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={entry.ratePerUnit}
                    onChange={(e) =>
                      updateEntry(idx, { ratePerUnit: Number(e.target.value) })
                    }
                  />
                  <div className="flex flex-col items-end justify-end gap-1 sm:col-span-2 lg:col-span-1">
                    {entries.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Remove room reading ${idx + 1}`}
                        onClick={() => removeEntry(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      {units} units · ₹{amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection title="Notes" description="Optional remarks for this bill" divided>
          <Textarea
            label="Notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
          />
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
