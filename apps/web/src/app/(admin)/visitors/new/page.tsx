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
  tenantId: z.string().min(1, 'Tenant ID is required'),
  visitorName: z.string().min(1, 'Visitor name is required'),
  visitorPhone: z.string().min(10, 'Phone must be at least 10 digits'),
  purpose: z.string().min(1, 'Purpose is required'),
  expectedArrival: z.string().min(1, 'Expected arrival is required'),
});

type FormData = z.infer<typeof schema>;

export default function NewVisitorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('visitors', { json: data }).json<{ success: boolean }>();
      router.push('/visitors');
    } catch {
      setSubmitError('Failed to register visitor. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            Register Visitor
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Record a new visitor entry</p>
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
            label="Tenant ID"
            placeholder="Enter tenant ID"
            error={errors.tenantId?.message}
            {...register('tenantId')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Visitor Name"
              placeholder="Full name"
              error={errors.visitorName?.message}
              {...register('visitorName')}
            />
            <Input
              label="Visitor Phone"
              placeholder="10-digit number"
              error={errors.visitorPhone?.message}
              {...register('visitorPhone')}
            />
          </div>
          <Input
            label="Purpose"
            placeholder="e.g. Family Visit, Delivery"
            error={errors.purpose?.message}
            {...register('purpose')}
          />
          <Input
            label="Expected Arrival"
            type="datetime-local"
            error={errors.expectedArrival?.message}
            {...register('expectedArrival')}
          />
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Register Visitor
          </Button>
        </div>
      </form>
    </div>
  );
}
