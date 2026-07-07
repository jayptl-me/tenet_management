'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.coerce.number().min(1, 'At least 1 item').optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewLaundrySlotPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('laundry-slots', { json: data }).json<{ success: boolean; data: { _id: string } }>();
      router.push('/laundry');
    } catch {
      setSubmitError('Failed to create laundry slot. Please try again.');
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
            New Laundry Slot
          </h2>
          <p className="text-[color:var(--color-surface-500)] mt-0.5 text-sm">
            Book a laundry slot for a tenant
          </p>
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-4 text-sm font-semibold text-[color:var(--color-danger-800)]">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select tenant..."
                error={errors.tenantId?.message}
              />
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Slot Date" type="date" error={errors.slotDate?.message} {...register('slotDate')} />
            <Input label="Slot Time" type="time" error={errors.slotTime?.message} {...register('slotTime')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Number of Items"
              type="number"
              placeholder="e.g., 5"
              error={errors.items?.message}
              {...register('items')}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--color-surface-800)] font-display text-sm font-semibold">
                Notes (Optional)
              </label>
              <textarea
                rows={3}
                className="font-[family:var(--font-body)] focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)] w-full rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base text-[color:var(--color-surface-900)] focus:outline-none focus:ring-offset-2"
                placeholder="Any special instructions..."
                {...register('notes')}
              />
            </div>
          </div>
        </div>

        <div className="border-t-[length:var(--bw-default)] border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Book Slot
          </Button>
        </div>
      </form>
    </div>
  );
}
