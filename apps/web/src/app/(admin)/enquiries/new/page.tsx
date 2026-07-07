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
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  preferredSharing: z.enum(['2', '3', '4', 'single']),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const SHARING_OPTIONS = [
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
  { value: 'single', label: 'Single' },
];

export default function NewEnquiryPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', message: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = { ...data, email: data.email || undefined };
    try {
      await api.post('enquiries', { json: payload }).json<{ success: boolean }>();
      router.push('/enquiries');
    } catch {
      setSubmitError('Failed to create enquiry. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Enquiry</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Record a new tenant enquiry</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              placeholder="Full name"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Phone"
              placeholder="10-digit phone number"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Select
              label="Preferred Sharing"
              options={SHARING_OPTIONS}
              error={errors.preferredSharing?.message}
              {...register('preferredSharing')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="message"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Message
            </label>
            <textarea
              id="message"
              rows={4}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Any additional details..."
              {...register('message')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Enquiry
          </Button>
        </div>
      </form>
    </div>
  );
}
