'use client';

import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Shirt, UserRound, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CrudFormPage } from '@/components/ui/CrudFormPage';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { useApiQuery } from '@/hooks/useApiQuery';

const schema = z.object({
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.preprocess(
    (v) => (v === '' || v === null || v === undefined || v === 0 ? 1 : v),
    z.coerce.number().int().min(1, 'At least 1 item'),
  ),
  status: z.enum(['booked', 'confirmed', 'completed', 'cancelled']),
  notes: z.string().max(300, 'Notes cannot exceed 300 characters').optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
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

/** Entity -> form values. Module-level so the shell's bridge effect stays stable. */
function mapSlotToValues(d: LaundryDetail): FormData {
  return {
    slotDate: d.slotDate ? String(d.slotDate).slice(0, 10) : '',
    slotTime: d.slotTime ?? '',
    items: d.items && d.items > 0 ? d.items : 1,
    status: (d.status as FormData['status']) ?? 'booked',
    notes: d.notes ?? '',
  };
}

export default function EditLaundrySlotPage() {
  const params = useParams();
  const id = params.id as string;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const { register, formState } = form;
  const { errors } = formState;

  // Same cache identity as the shell's `load`: one request shared between the
  // form reset and the preflight panel below.
  const slotQuery = useApiQuery<LaundryDetail>(['laundry-slots', id], `laundry-slots/${id}`);

  const tenant = slotQuery.data?.tenantId;
  const err = errors as Record<string, { message?: string }>;

  return (
    <CrudFormPage
      title="Edit Laundry Slot"
      description="Update booking time, item count, and status"
      backHref="/laundry"
      redirectTo="/laundry"
      mode="edit"
      maxWidth="3xl"
      form={form}
      load={{
        queryKey: ['laundry-slots', id],
        path: `laundry-slots/${id}`,
        mapToValues: mapSlotToValues,
      }}
      submit={async ({ values }) => {
        await api.put(`laundry-slots/${id}`, { json: values }).json();
      }}
      preflight={
        tenant ? (
          <DetailCard title="Booked by" icon={<UserRound />}>
            <DetailList>
              <DetailRow label="Name" value={tenant.userId?.name ?? 'N/A'} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    {tenant.roomId?.roomNumber ?? 'N/A'} · Bed {tenant.bedId ?? 'N/A'}
                  </span>
                }
              />
              <DetailRow label="Phone" value={tenant.userId?.phone ?? 'N/A'} />
            </DetailList>
          </DetailCard>
        ) : undefined
      }
    >
      <FormSection
        title="Slot details"
        description="When the laundry slot is booked and how many items"
      >
        <FormGrid>
          <DatePicker
            label="Slot date"
            error={err.slotDate?.message}
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
            min={1}
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
    </CrudFormPage>
  );
}
