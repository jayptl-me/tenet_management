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
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relation: z.enum(['father', 'mother', 'guardian', 'other']),
});

type FormData = z.infer<typeof schema>;

const RELATION_OPTIONS = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

export default function NewGuardianPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = { ...data, email: data.email || undefined };
    try {
      await api.post('guardians', { json: payload }).json<{ success: boolean }>();
      router.push('/guardians');
    } catch {
      setSubmitError('Failed to create guardian. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Guardian</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a guardian for a tenant</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
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
            <Input label="Name" placeholder="Full name" error={errors.name?.message} {...register('name')} />
            <Input label="Phone" placeholder="10-digit number" error={errors.phone?.message} {...register('phone')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" placeholder="email@example.com" error={errors.email?.message} {...register('email')} />
            <Select label="Relation" options={RELATION_OPTIONS} error={errors.relation?.message} {...register('relation')} />
          </div>
        </div>
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" />Save Guardian</Button>
        </div>
      </form>
    </div>
  );
}
