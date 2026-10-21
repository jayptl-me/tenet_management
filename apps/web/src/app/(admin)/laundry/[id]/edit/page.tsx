'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Shirt, UserRound, Hash, Info, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CrudFormPage } from '@/components/ui/CrudFormPage';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
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

interface LaundryTenant {
  _id: string;
  bedId?: string | null;
  user?: { name?: string; phone?: string };
  room?: { roomNumber?: string; floor?: { label?: string } | null };
}

interface LaundryDetail {
  _id: string;
  tenant?: LaundryTenant;
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

/**
 * The server's own words for a refusal.
 *
 * The shared parser maps every 400 to one generic sentence, and the laundry
 * route puts the reason in the message of the response. The office has to
 * read the reason.
 */
async function serverMessage(err: unknown): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: unknown }).response;
    if (res instanceof Response) {
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        const message = body?.error?.message;
        if (typeof message === 'string' && message.trim() !== '') return message;
      } catch {
        // The body was not a JSON envelope: the shared parser takes over.
      }
    }
  }
  return (await parseApiError(err)).message;
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
  const watchedSlotDate = useWatch({ control: form.control, name: 'slotDate' }) ?? '';
  const { errors } = form.formState;
  const err = errors as Record<string, { message?: string }>;

  // Same cache identity as the shell's `load`: one request shared between the
  // form reset and the preflight panel below.
  const slotQuery = useApiQuery<LaundryDetail>(['laundry-slots', id], `laundry-slots/${id}`);

  const tenant = slotQuery.data?.tenant;
  const recordStatus = slotQuery.data?.status ?? '';

  /**
   * A closed slot can only be reopened.
   *
   * The server refuses every move out of completed or cancelled that does not
   * land on booked (apps/api/src/routes/laundry.ts:359-374), so the moves it
   * would refuse are shown but cannot be picked.
   */
  const isClosed = recordStatus === 'completed' || recordStatus === 'cancelled';
  // A stable reference: the picker syncs itself to the native select when the
  // options change, so a new array on every render would sync on every render.
  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => ({
        ...option,
        disabled: isClosed && option.value !== 'booked',
      })),
    [isClosed],
  );

  return (
    <CrudFormPage
      title="Edit the laundry slot"
      description="Move the place, change the load, or close the slot"
      backHref={`/laundry/${id}`}
      redirectTo={`/laundry/${id}`}
      mode="edit"
      maxWidth="form"
      form={form}
      load={{
        queryKey: ['laundry-slots', id],
        path: `laundry-slots/${id}`,
        mapToValues: mapSlotToValues,
      }}
      preflight={
        <DetailCard title="The slot you are changing" icon={<UserRound />}>
          <DetailList>
            <DetailRow label="Resident" value={tenant?.user?.name ?? 'Unknown resident'} />
            <DetailRow
              label="Room"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-(--color-text-muted)" />
                  {tenant?.room?.roomNumber ?? 'unknown'} · Bed {tenant?.bedId ?? 'unknown'}
                </span>
              }
            />
            <DetailRow label="Phone" value={tenant?.user?.phone ?? 'not reported'} />
          </DetailList>

          <div className="text-2xs mt-3 space-y-2 font-medium text-(--color-text-secondary)">
            <p>
              <strong className="text-(--color-text-primary)">What the save commits.</strong> The
              server writes the date, the time, the number of items, the note and the status, and
              writes an update entry in the audit log. It changes nothing else: the place is still
              the place of that resident at that time.
            </p>
            <p>
              <strong className="text-(--color-text-primary)">Who is told.</strong> The server
              pushes a message to the resident only when the status moves to confirmed
              (apps/api/src/routes/laundry.ts:436-443). Every other save here reaches nobody: the
              resident sees the new state the next time they open the portal.
            </p>
            <p>
              <strong className="text-(--color-text-primary)">What the save refuses.</strong> The
              server compares the date the save carries with its own today and refuses the whole
              write when the day has passed (apps/api/src/routes/laundry.ts:376-381). A slot of a
              day that is gone cannot be closed or corrected until you move it to today or later. It
              also refuses a second booking by the same resident for the same date and time
              (DUPLICATE_SLOT), and it refuses a move out of a closed slot that does not land on
              booked.
            </p>
          </div>
        </DetailCard>
      }
      submit={async ({ values }) => {
        try {
          await api.put(`laundry-slots/${id}`, { json: values }).json();
        } catch (err) {
          throw new Error(await serverMessage(err));
        }
      }}
    >
      <FormSection
        title="The place"
        description="When the slot is and how many items the resident brings"
      >
        <FormGrid>
          <DatePicker
            label="Slot date"
            error={err.slotDate?.message}
            name="slotDate"
            value={watchedSlotDate}
            onChange={(value) => form.setValue('slotDate', value, { shouldValidate: true })}
          />
          <Input
            label="Slot time"
            type="time"
            error={err.slotTime?.message}
            leftIcon={<Clock className="h-4 w-4" />}
            {...form.register('slotTime')}
          />
          <Input
            label="Item count"
            type="number"
            min={1}
            error={err.items?.message}
            leftIcon={<Shirt className="h-4 w-4" />}
            {...form.register('items')}
          />
          <Select
            label="Status"
            options={statusOptions}
            error={err.status?.message}
            helperText={
              isClosed
                ? `This slot is ${recordStatus}. The server refuses every move out of it except reopening it to booked, so the other moves cannot be picked.`
                : 'The server refuses a move out of a closed slot that does not land on booked.'
            }
            {...form.register('status')}
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Notes" description="Optional remarks for this booking" divided>
        <FormGrid cols={1}>
          <Textarea
            label="Notes"
            rows={3}
            placeholder="Optional notes..."
            error={err.notes?.message}
            {...form.register('notes')}
          />
        </FormGrid>
      </FormSection>

      <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        The resident who holds this slot is {tenant?.user?.name ?? 'not named on the record'}. The
        save tells them only when it moves the slot to confirmed.
      </p>

      {isClosed && (
        <p className="text-2xs flex items-start gap-1.5 font-semibold text-(--color-warning-800)">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This slot is {recordStatus}. The only move the server takes is back to booked, and the
          save is refused when the day of the slot has passed.
        </p>
      )}
    </CrudFormPage>
  );
}
