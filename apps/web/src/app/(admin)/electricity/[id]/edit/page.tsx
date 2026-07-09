'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { fieldControlBase, fieldControlBorderOk, fieldLabelClass, surfaceNestedClass } from '@/lib/field-styles';
import { roomLabel } from '@/lib/resource-select-presets';
import { clsx } from 'clsx';

interface RoomOption {
  _id: string;
  roomNumber: string;
  sharingType?: number;
}

interface RoomEntryForm {
  roomId: string;
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
}

function roomIdOf(entry: { roomId?: string | { _id?: string } }): string {
  if (!entry.roomId) return '';
  if (typeof entry.roomId === 'string') return entry.roomId;
  return entry.roomId._id ?? '';
}

export default function EditElectricityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [month, setMonth] = useState('');
  const [totalBillAmount, setTotalBillAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [entries, setEntries] = useState<RoomEntryForm[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`electricity/${id}`).json<{
        success: boolean;
        data: {
          month: string;
          totalBillAmount: number;
          notes?: string;
          status: string;
          roomEntries: Array<{
            roomId?: string | { _id?: string };
            previousReading: number;
            currentReading: number;
            ratePerUnit: number;
          }>;
        };
      }>(),
      api.get('rooms?limit=100').json<{ success: boolean; data: RoomOption[] }>(),
    ])
      .then(([billRes, roomsRes]) => {
        const b = billRes.data;
        setMonth(b.month);
        setTotalBillAmount(b.totalBillAmount);
        setNotes(b.notes ?? '');
        setStatus(b.status);
        setEntries(
          (b.roomEntries ?? []).map((e) => ({
            roomId: roomIdOf(e),
            previousReading: e.previousReading,
            currentReading: e.currentReading,
            ratePerUnit: e.ratePerUnit,
          })),
        );
        setRooms(roomsRes.data ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load electricity bill');
        setIsLoading(false);
      });
  }, [id]);

  const updateEntry = (idx: number, patch: Partial<RoomEntryForm>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (status === 'distributed') {
      setSubmitError('Distributed bills cannot be edited');
      return;
    }
    if (entries.some((en) => !en.roomId || en.currentReading < en.previousReading)) {
      setSubmitError('Check room selection and readings (current >= previous)');
      return;
    }
    setIsSubmitting(true);
    try {
      await api
        .put(`electricity/${id}`, {
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
        .json();
      router.push(`/electricity/${id}`);
    } catch {
      setSubmitError('Failed to update electricity bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormPage
      title="Edit Electricity Bill"
      description={`Status: ${status} · units and amounts recompute on save`}
      backHref="/electricity"
      error={submitError}
      isLoading={isLoading}
      maxWidth="4xl"
    >
      <FormCard
        onSubmit={onSubmit}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/electricity"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <div className="space-y-6">
          <FormSection
            title="Bill details"
            description="Billing month and total amount for this cycle"
          >
            <FormGrid>
              <Input label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
              <Input
                label="Total bill amount"
                type="number"
                step="0.01"
                value={totalBillAmount}
                onChange={(e) => setTotalBillAmount(Number(e.target.value))}
              />
            </FormGrid>
          </FormSection>

          <FormSection
            title="Room readings"
            divided
            description="Per-room meter readings for this billing period"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setEntries((p) => [
                    ...p,
                    { roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 },
                  ])
                }
              >
                <Plus className="h-4 w-4" /> Add room
              </Button>
            }
          >
            <div className="space-y-3">
              {entries.length === 0 && (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-color)] px-4 py-8 text-center text-sm text-[color:var(--color-text-secondary)]">
                  No room readings yet. Add a room to begin.
                </p>
              )}
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    surfaceNestedClass,
                    'grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]',
                  )}
                >
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                    <label className={fieldLabelClass} htmlFor={`elec-room-${idx}`}>
                      Room
                    </label>
                    <select
                      id={`elec-room-${idx}`}
                      className={clsx(fieldControlBase, fieldControlBorderOk, 'appearance-none')}
                      value={entry.roomId}
                      onChange={(e) => updateEntry(idx, { roomId: e.target.value })}
                    >
                      <option value="">Select room...</option>
                      {rooms.map((r) => (
                        <option key={r._id} value={r._id}>
                          {roomLabel(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Previous"
                    type="number"
                    inputMode="numeric"
                    value={entry.previousReading}
                    onChange={(e) => updateEntry(idx, { previousReading: Number(e.target.value) })}
                  />
                  <Input
                    label="Current"
                    type="number"
                    inputMode="numeric"
                    value={entry.currentReading}
                    onChange={(e) => updateEntry(idx, { currentReading: Number(e.target.value) })}
                  />
                  <Input
                    label="Rate / unit"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={entry.ratePerUnit}
                    onChange={(e) => updateEntry(idx, { ratePerUnit: Number(e.target.value) })}
                  />
                  <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remove room reading ${idx + 1}`}
                      onClick={() => setEntries((p) => p.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection title="Notes" divided>
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes..."
            />
          </FormSection>
        </div>
      </FormCard>
    </FormPage>
  );
}
