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
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email'),
  monthlyRent: z.coerce.number().positive('Monthly rent must be positive'),
  depositPaid: z.coerce.number().min(0, 'Deposit cannot be negative'),
  isActive: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api.get(`tenants/${id}`).json<{ success: boolean; data: any }>()
      .then((res) => {
        const d = res.data;
        reset({
          name: d.user?.name ?? '',
          phone: d.user?.phone ?? '',
          email: d.user?.email ?? '',
          monthlyRent: d.monthlyRent ?? 0,
          depositPaid: d.depositPaid ?? 0,
          isActive: d.isActive ? 'true' : 'false',
        });
        setIsLoading(false);
      })
      .catch(() => { setSubmitError('Failed to load tenant'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`tenants/${id}`, {
        json: {
          monthlyRent: data.monthlyRent,
          depositPaid: data.depositPaid,
          isActive: data.isActive === 'true',
          user: {
            name: data.name,
            phone: data.phone,
            email: data.email,
          },
        },
      }).json();
      router.push('/tenants');
    } catch {
      setSubmitError('Failed to update tenant');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Tenant</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update tenant details</p>
        </div>
      </div>
      {submitError && <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">{submitError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <Input label="Name" error={errors.name?.message} {...register('name')} />
          <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Monthly Rent" type="number" step="0.01" error={errors.monthlyRent?.message} {...register('monthlyRent')} />
          <Input label="Deposit Paid" type="number" step="0.01" error={errors.depositPaid?.message} {...register('depositPaid')} />
          <Select
            label="Status"
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Checked Out' },
            ]}
            error={errors.isActive?.message}
            {...register('isActive')}
          />
        </div>
        <div className="border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
