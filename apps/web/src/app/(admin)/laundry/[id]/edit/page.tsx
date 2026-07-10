'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Clock, Shirt, UserRound, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

const schema = z.object({
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.coerce.number().min(0, 'Must be >= 0').optional(),
  status: z.enum(['booked', 'completed', 'cancelled', 'maintenance']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'maintenance', label: 'Maintenance' },
];

interface LaundryDetail {
  _id: string;
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  tenantId?: {
    _id?: string;
    userId?: { name?: string; phone?: string };
    roomId?: { roomNumber?: string };
    bedId?: string;
  };
  createdAt: string;
}

export default function EditLaundrySlotPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [slotData, setSlotData] = useState<LaundryDetail | null>(null);

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
      .get(`laundry-slots/${id}`)
      .json<{ success: boolean; data: LaundryDetail }>()
      .then((res) => {
        setSlotData(res.data);
        const d = res.data;
        reset({
          slotDate: d.slotDate ? String(d.slotDate).slice(0, 10) : '',
          slotTime: d.slotTime ?? '',
          items: d.items ?? 0,
          status: (d.status as FormData['status']) ?? 'booked',
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load laundry slot');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`laundry-slots/${id}`, { json: data }).json();
      router.push('/laundry');
    } catch {
      setSubmitError('Failed to update laundry slot');
    }
  };

  const tenant = slotData?.tenantId;
  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Laundry Slot"
      description="Update booking time, item count, and status"
      backHref="/laundry"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {tenant && (
          <DetailCard title="Booked by" icon={<UserRound />}>
            <DetailList>
              <DetailRow label="Name" value={tenant.userId?.name ?? 'N/A'} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {tenant.roomId?.roomNumber ?? 'N/A'} · Bed {tenant.bedId ?? 'N/A'}
                  </span>
                }
              />
              <DetailRow label="Phone" value={tenant.userId?.phone ?? 'N/A'} />
            </DetailList>
          </DetailCard>
        )}

        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/laundry"
              submitLabel="Save Changes"
              divided={false}
            />
          }
        >
          <FormSection
            title="Slot details"
            description="When the laundry slot is booked and how many items"
          >
            <FormGrid>
              <Input
                label="Slot date"
                type="date"
                error={err.slotDate?.message}
                leftIcon={<CalendarDays className="h-4 w-4" />}
                {...register('slotDate')}
              />
              <Input
                label="Slot time"
                type="time"
                error={err.slotTime?.message}
                leftIcon={<Clock className="h-4 w-4" />}
                {...register('slotTime')}
              />
              <Input
                label="Item count"
                type="number"
                min={0}
                error={err.items?.message}
                leftIcon={<Shirt className="h-4 w-4" />}
                {...register('items')}
              />
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                error={err.status?.message}
                {...register('status')}
              />
            </FormGrid>
          </FormSection>

          <FormSection title="Notes" description="Optional remarks for this booking" divided>
            <FormGrid cols={1}>
              <FormFullWidth>
                <Textarea
                  label="Notes"
                  rows={3}
                  placeholder="Optional notes..."
                  error={err.notes?.message}
                  {...register('notes')}
                />
              </FormFullWidth>
            </FormGrid>
          </FormSection>
        </FormCard>
      </div>
    </FormPage>
  );
}
