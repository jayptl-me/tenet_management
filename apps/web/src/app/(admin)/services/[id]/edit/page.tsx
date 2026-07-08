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
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  serviceType: z.string().min(1, 'Service type is required'),
  status: z.string().min(1, 'Status is required'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const serviceTypeOptions = [
  { value: 'wifi', label: 'WiFi' },
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'power', label: 'Power' },
  { value: 'ac', label: 'Air Conditioning' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'elevator', label: 'Elevator' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
];

const serviceStatusOptions = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
];

export default function EditServicePage() {
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
    api.get(`services/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load service'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`services/${id}`, { json: data }).json();
      router.push('/services');
    } catch {
      setSubmitError('Failed to update service');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Service Status</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update service status details</p>
        </div>
      </div>
      {submitError && <ErrorBanner message={submitError} />}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <Select label="Service Type" options={serviceTypeOptions} error={errors.serviceType?.message} {...register('serviceType')} />
          <Select label="Status" options={serviceStatusOptions} error={errors.status?.message} {...register('status')} />
          <Input label="Note" error={errors.note?.message} {...register('note')} />
        </div>
        <div className="border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
