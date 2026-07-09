'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { roomLabel } from '@/lib/resource-select-presets';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            Edit Electricity Bill
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Status: {status} · units and amounts recompute on save
          </p>
        </div>
      </div>
      {submitError && <ErrorBanner message={submitError} />}
      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Input
            label="Total Bill Amount"
            type="number"
            step="0.01"
            value={totalBillAmount}
            onChange={(e) => setTotalBillAmount(Number(e.target.value))}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold">Room Readings</h3>
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
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-4">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-3 rounded-lg border border-[color:var(--border-color)] p-4 sm:grid-cols-2 lg:grid-cols-5"
              >
                <select
                  className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm"
                  value={entry.roomId}
                  onChange={(e) => updateEntry(idx, { roomId: e.target.value })}
                >
                  <option value="">Room...</option>
                  {rooms.map((r) => (
                    <option key={r._id} value={r._id}>
                      {roomLabel(r)}
                    </option>
                  ))}
                </select>
                <Input
                  label="Previous"
                  type="number"
                  value={entry.previousReading}
                  onChange={(e) => updateEntry(idx, { previousReading: Number(e.target.value) })}
                />
                <Input
                  label="Current"
                  type="number"
                  value={entry.currentReading}
                  onChange={(e) => updateEntry(idx, { currentReading: Number(e.target.value) })}
                />
                <Input
                  label="Rate"
                  type="number"
                  step="0.01"
                  value={entry.ratePerUnit}
                  onChange={(e) => updateEntry(idx, { ratePerUnit: Number(e.target.value) })}
                />
                <div className="flex items-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEntries((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
