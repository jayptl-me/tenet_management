'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, UserRound, DoorOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required'),
  visitorPhone: z.string().min(10, 'Phone must be at least 10 digits'),
  purpose: z.string().min(1, 'Purpose is required'),
  status: z.enum(['expected', 'arrived', 'departed', 'cancelled']),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'expected', label: 'Expected' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'departed', label: 'Departed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EditVisitorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`visitors/${id}`)
      .json<{ success: boolean; data: FormData & { _id: string } }>()
      .then((res) => {
        // GET /visitors/:id returns name/phone (via model toJSON alias)
        // Form expects visitorName/visitorPhone — map accordingly
        const d = res.data as Record<string, unknown>;
        reset({
          visitorName: (d.name as string) ?? '',
          visitorPhone: (d.phone as string) ?? '',
          purpose: (d.purpose as string) ?? '',
          status: (d.status as 'expected' | 'arrived' | 'departed' | 'cancelled') ?? 'expected',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load visitor');
        setIsLoading(false);
      });
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

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Visitor"
      description="Update visitor details and check-in status"
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
        <FormSection title="Visitor details" description="Who is visiting and how to reach them">
          <FormGrid>
            <Input
              label="Full name"
              placeholder="Visitor name"
              error={err.visitorName?.message}
              leftIcon={<UserRound className="h-4 w-4" />}
              autoComplete="name"
              {...register('visitorName')}
            />
            <Input
              label="Phone number"
              placeholder="+919876543210"
              inputMode="tel"
              error={err.visitorPhone?.message}
              leftIcon={<Phone className="h-4 w-4" />}
              autoComplete="tel"
              {...register('visitorPhone')}
            />
            <Input
              label="Purpose of visit"
              placeholder="e.g. Guest visit, delivery, maintenance"
              error={err.purpose?.message}
              leftIcon={<DoorOpen className="h-4 w-4" />}
              {...register('purpose')}
            />
            <Select
              label="Status"
              options={statusOptions}
              error={err.status?.message}
              {...register('status')}
            />
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
