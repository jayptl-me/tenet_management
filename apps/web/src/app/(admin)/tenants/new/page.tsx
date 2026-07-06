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

const schema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  roomId: z.string().min(1, 'Room ID is required'),
  bedId: z.string().min(1, 'Bed ID is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  depositPaid: z.coerce.number().min(0, 'Must be >= 0'),
  monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
});

type FormData = z.infer<typeof schema>;

export default function NewTenantPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { depositPaid: 0, monthlyRent: 0 },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('tenants', { json: data }).json<{ success: boolean }>();
      router.push('/tenants');
    } catch {
      setSubmitError('Failed to create tenant. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Tenant</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a new tenant to the PG</p>
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
          <Input
            label="User ID"
            placeholder="Enter user ID"
            error={errors.userId?.message}
            {...register('userId')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Room ID"
              placeholder="Enter room ID"
              error={errors.roomId?.message}
              {...register('roomId')}
            />
            <Input
              label="Bed ID"
              placeholder="e.g. A, B, C, D"
              error={errors.bedId?.message}
              {...register('bedId')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Move-in Date"
              type="date"
              error={errors.moveInDate?.message}
              {...register('moveInDate')}
            />
            <Input
              label="Deposit Paid (₹)"
              type="number"
              error={errors.depositPaid?.message}
              {...register('depositPaid')}
            />
            <Input
              label="Monthly Rent (₹)"
              type="number"
              error={errors.monthlyRent?.message}
              {...register('monthlyRent')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Tenant
          </Button>
        </div>
      </form>
    </div>
  );
}
