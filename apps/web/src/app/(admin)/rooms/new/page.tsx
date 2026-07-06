'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const schema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  floorId: z.string().min(1, 'Floor ID is required'),
  sharingType: z.coerce.number().refine((v) => [2, 3, 4].includes(v), 'Must be 2, 3, or 4'),
  monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const SHARING_OPTIONS = [
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
];

export default function NewRoomPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sharingType: 2, monthlyRent: 0, description: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('rooms', { json: data }).json<{ success: boolean }>();
      router.push('/rooms');
    } catch {
      setSubmitError('Failed to create room. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Room</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a new room to the PG</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Room Number"
              placeholder="e.g. 101, G2"
              error={errors.roomNumber?.message}
              {...register('roomNumber')}
            />
            <Input
              label="Floor ID"
              placeholder="Enter floor ID"
              error={errors.floorId?.message}
              {...register('floorId')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Sharing Type"
              options={SHARING_OPTIONS}
              error={errors.sharingType?.message}
              {...register('sharingType')}
            />
            <Input
              label="Monthly Rent (₹)"
              type="number"
              error={errors.monthlyRent?.message}
              {...register('monthlyRent')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="description"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Optional description..."
              {...register('description')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Room
          </Button>
        </div>
      </form>
    </div>
  );
}
