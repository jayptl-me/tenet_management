'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  roomId: z.string().min(1, 'Room is required'),
  bedId: z.string().min(1, 'Bed is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  depositPaid: z.coerce.number().min(0, 'Must be >= 0'),
  monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
});

type FormData = z.infer<typeof schema>;

function TenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');

  const prefilledName = searchParams.get('name') || '';
  const prefilledPhone = searchParams.get('phone') || '';
  const prefilledEmail = searchParams.get('email') || '';

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: prefilledName,
      email: prefilledEmail,
      phone: prefilledPhone,
      depositPaid: 0,
      monthlyRent: 0,
    },
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

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name" placeholder="Tenant name" error={errors.name?.message} {...register('name')} />
            <Input label="Email" type="email" placeholder="tenant@email.com" error={errors.email?.message} {...register('email')} />
          </div>
          <Input label="Phone" placeholder="+919876543210" error={errors.phone?.message} {...register('phone')} />
          <Controller
            name="roomId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Room"
                endpoint="rooms"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select room..."
                error={errors.roomId?.message}
              />
            )}
          />
          <Input label="Bed ID" placeholder="A, B, C, or D" error={errors.bedId?.message} {...register('bedId')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Move-in Date" type="date" error={errors.moveInDate?.message} {...register('moveInDate')} />
            <Input label="Deposit Paid (₹)" type="number" error={errors.depositPaid?.message} {...register('depositPaid')} />
            <Input label="Monthly Rent (₹)" type="number" error={errors.monthlyRent?.message} {...register('monthlyRent')} />
          </div>
        </div>
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
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

export default function NewTenantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
        </div>
      }
    >
      <TenantForm />
    </Suspense>
  );
}
