'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  message: z.string().optional(),
  source: z.string().min(1, 'Source is required'),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const sourceOptions = [
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
];

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

export default function EditEnquiryPage() {
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
    api.get(`enquiries/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load enquiry'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`enquiries/${id}`, { json: data }).json();
      router.push('/enquiries');
    } catch {
      setSubmitError('Failed to update enquiry');
    }
  };

  return (
    <FormPage
      title="Edit enquiry"
      description="Update lead contact and pipeline status"
      backHref="/enquiries"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/enquiries"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Contact" description="Prospect details from the enquiry">
          <FormGrid>
            <Input label="Name" error={errors.name?.message} autoComplete="name" {...register('name')} />
            <Input label="Phone" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <Select
              label="Source"
              options={sourceOptions}
              error={errors.source?.message}
              {...register('source')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Follow-up" description="Message and pipeline status" divided>
          <FormGrid>
            <Select
              label="Status"
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
            <FormFullWidth>
              <Textarea
                label="Message"
                rows={3}
                placeholder="Enter message..."
                error={errors.message?.message}
                {...register('message')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
