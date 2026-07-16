'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, UserRound, DoorOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  visitorName: z.string().min(2, 'Visitor name must be at least 2 characters').max(100),
  visitorPhone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  purpose: z.string().min(1, 'Purpose is required').max(200),
  expectedArrival: z.string().min(1, 'Expected arrival is required'),
});

type FormData = z.infer<typeof schema>;

export default function EditVisitorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string>('');

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
      .json<{ success: boolean; data: FormData & { _id: string; status?: string } }>()
      .then((res) => {
        const d = res.data as Record<string, unknown>;
        const arrivalRaw = (d.expectedArrival as string) ?? '';
        let expectedArrival = '';
        if (arrivalRaw) {
          const dt = new Date(arrivalRaw);
          if (!Number.isNaN(dt.getTime())) {
            // datetime-local wants local YYYY-MM-DDTHH:mm
            const pad = (n: number) => String(n).padStart(2, '0');
            expectedArrival = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
          }
        }
        setCurrentStatus(typeof d.status === 'string' ? d.status : '');
        reset({
          visitorName: (d.visitorName as string) ?? (d.name as string) ?? '',
          visitorPhone: (d.visitorPhone as string) ?? (d.phone as string) ?? '',
          purpose: (d.purpose as string) ?? '',
          expectedArrival,
        });
        setIsLoading(false);
      })
      .catch(async (err) => {
        setSubmitError((await parseApiError(err)).message);
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      // Status is intentionally omitted — lifecycle (arrive/depart/cancel) is FSM-driven
      // via dedicated actions on the visitor detail page.
      await api
        .put(`visitors/${id}`, {
          json: {
            visitorName: data.visitorName.trim(),
            visitorPhone: normalizeInPhone(data.visitorPhone),
            purpose: data.purpose,
            expectedArrival: new Date(data.expectedArrival).toISOString(),
          },
        })
        .json();
      router.push(`/visitors/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const statusLabel = currentStatus
    ? currentStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';

  return (
    <FormPage
      title="Edit Visitor"
      description="Update visitor metadata. Use Arrive / Depart on the detail page for status."
      backHref={`/visitors/${id}`}
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref={`/visitors/${id}`}
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
            <Input
              label="Expected arrival"
              type="datetime-local"
              error={err.expectedArrival?.message}
              {...register('expectedArrival')}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">Status</p>
              <p className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm text-[color:var(--color-text-secondary)]">
                {statusLabel}
              </p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Use Arrive / Depart / Cancel on the visitor detail page. Status cannot be set freely
                here.
              </p>
            </div>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
