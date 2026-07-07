'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const schema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  floorId: z.string().min(1, 'Floor is required'),
  sharingType: z.coerce.number().refine((v) => [2, 3, 4].includes(v), 'Must be 2, 3, or 4'),
  monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
  isActive: z.boolean(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const SHARING_OPTIONS = [
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
];

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [fetchError, setFetchError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!roomId) return;
    api
      .get(`rooms/${roomId}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => {
        reset(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setFetchError('Failed to load room data');
        setIsLoading(false);
      });
  }, [roomId, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`rooms/${roomId}`, { json: data }).json<{ success: boolean }>();
      router.push('/rooms');
    } catch {
      setSubmitError('Failed to update room');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">{fetchError}</div>
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
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Edit Room</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Update room details</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">{submitError}</div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Room Number" placeholder="e.g. 101" error={errors.roomNumber?.message} {...register('roomNumber')} />
            <Input label="Floor ID" placeholder="Floor ID" error={errors.floorId?.message} {...register('floorId')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Sharing Type" options={SHARING_OPTIONS} error={errors.sharingType?.message} {...register('sharingType')} />
            <Input label="Monthly Rent (₹)" type="number" error={errors.monthlyRent?.message} {...register('monthlyRent')} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('isActive')} className="text-brand-500 h-5 w-5 rounded border-[length:var(--bw-default)]" />
            <span className="text-surface-700 text-sm font-semibold">Active</span>
          </label>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
