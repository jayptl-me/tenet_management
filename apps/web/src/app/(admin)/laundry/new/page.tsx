'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, CalendarDays, Package, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Textarea } from '@/components/ui/Textarea';
import { CrudFormPage } from '@/components/ui/CrudFormPage';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { DetailCard } from '@/components/ui/DetailCard';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 1 : v),
    z.coerce.number().int().min(1, 'At least 1 item'),
  ),
  notes: z.string().max(300, 'Notes cannot exceed 300 characters').optional(),
});

type FormData = z.infer<typeof schema>;

/**
 * The day the server calls today.
 *
 * The server compares a slot date with its own UTC clock
 * (apps/api/src/routes/laundry.ts:269), so the picker starts from the same
 * day. A local calendar day would be one day ahead of the server for half
 * the day, and the booking would be refused.
 */
function serverToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The server's own words for a refusal.
 *
 * The shared parser maps every 400 to one generic sentence, and the laundry
 * route puts the reason in the message of the response (a date in the past, a
 * full slot time, a duplicate booking). The office has to read the reason.
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

export default function NewLaundrySlotPage() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const watchedSlotDate = useWatch({ control: form.control, name: 'slotDate' }) ?? '';
  const { errors } = form.formState;

  return (
    <CrudFormPage
      title="Book a laundry slot"
      description="Hold a place in the queue of a slot time for a resident"
      backHref="/laundry"
      redirectTo="/laundry"
      submitLabel="Book the slot"
      mode="create"
      maxWidth="form"
      form={form}
      preflight={
        <DetailCard title="What this booking commits" icon={<Info />}>
          <div className="text-2xs space-y-2 font-medium text-(--color-text-secondary)">
            <p>
              The server creates the slot with the status booked, the date, the time, the number of
              items and the note, and writes a create entry in the audit log. It charges nothing:
              there is no money on a laundry slot.
            </p>
            <p>
              <strong className="text-(--color-text-primary)">The resident is not told.</strong> The
              server sends no message when a slot is booked. A resident who booked it in the portal
              already knows; a slot you book for them reaches them only when you confirm it, and the
              confirmation is the one write that pushes a message.
            </p>
            <p>
              The server refuses a date before its own today, a slot time that already carries five
              bookings that are not cancelled (SLOT_FULL), and a second booking by the same resident
              for the same date and time (DUPLICATE_SLOT).
            </p>
            <p>
              The picker lists the residents who are in the house. The server does not check the
              state of the resident: it accepts a slot for a resident who has left, and the place is
              held for nobody.
            </p>
          </div>
        </DetailCard>
      }
      submit={async ({ values }) => {
        // Page-owned message shaping: the shell formats thrown errors through
        // parseApiError, which passes a plain Error message through unchanged.
        try {
          const res = await api
            .post('laundry-slots', { json: values })
            .json<{ success: boolean; data: { _id: string } }>();
          const id = res?.data?._id;
          // The office lands on the record the server wrote, not on the list.
          return id ? { redirectTo: `/laundry/${id}` } : undefined;
        } catch (err) {
          throw new Error(await serverMessage(err));
        }
      }}
    >
      <FormSection
        title="Resident"
        icon={<UserRound />}
        description="The resident who holds the place"
      >
        <Controller
          name="tenantId"
          control={form.control}
          render={({ field }) => (
            <ResourceSelect
              label="Resident"
              endpoint="tenants?isActive=true"
              value={field.value}
              onChange={field.onChange}
              placeholder="Select the resident..."
              error={errors.tenantId?.message}
              helperText="The picker lists the residents who are in the house. The server does not check the state of the resident."
              valueKey="_id"
              labelKey={tenantLabel}
              sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
              dataPath="data"
            />
          )}
        />
      </FormSection>

      <FormSection
        title="Schedule"
        icon={<CalendarDays />}
        description="The place is held for a date and a time, and the server allows five places per time"
        divided
      >
        <FormGrid>
          <DatePicker
            label="Slot date"
            error={errors.slotDate?.message}
            helperText="The server refuses a date before its own today."
            min={serverToday()}
            name="slotDate"
            value={watchedSlotDate}
            onChange={(value) => form.setValue('slotDate', value, { shouldValidate: true })}
          />
          <Input
            label="Slot time"
            type="time"
            error={errors.slotTime?.message}
            helperText="The server refuses a time that already carries five bookings that are not cancelled."
            {...form.register('slotTime')}
          />
        </FormGrid>
      </FormSection>

      <FormSection
        title="Load"
        icon={<Package />}
        description="What the resident brings down, and anything the desk should know"
        divided
      >
        <FormGrid>
          <Input
            label="Number of items"
            type="number"
            min={1}
            placeholder="e.g., 5"
            error={errors.items?.message}
            helperText="The server stores the count and shows it on the slot. Nothing is priced."
            {...form.register('items')}
          />
          <Textarea
            label="Notes (optional)"
            rows={3}
            placeholder="Any special instructions..."
            error={errors.notes?.message}
            helperText="Max 300 characters. The note is on the slot and the resident sees it in the portal."
            {...form.register('notes')}
          />
        </FormGrid>
      </FormSection>
    </CrudFormPage>
  );
}
