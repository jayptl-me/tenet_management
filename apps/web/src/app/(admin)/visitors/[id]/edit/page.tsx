'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  purpose: z.string().min(1, 'Purpose is required'),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EditVisitorPage() {
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
    api.get(`visitors/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load visitor'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`visitors/${id}`, { json: data }).json();
      router.push('/visitors');
    } catch {
      setSubmitError('Failed to update visitor');
    }
  };

  return (
    <FormPage
      title="Edit visitor"
      description="Update visitor contact and visit status"
      backHref="/visitors"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/visitors"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Visitor details" description="Who is visiting and why">
          <FormGrid>
            <Input label="Name" error={errors.name?.message} autoComplete="name" {...register('name')} />
            <Input label="Phone" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
            <Input
              label="Purpose"
              placeholder="e.g. Guest visit, delivery, maintenance"
              error={errors.purpose?.message}
              {...register('purpose')}
            />
            <Select label="Status" options={statusOptions} error={errors.status?.message} {...register('status')} />
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
