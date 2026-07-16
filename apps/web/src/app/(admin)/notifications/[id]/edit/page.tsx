'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import {
  floorLabel,
  roomLabel,
  roomSublabel,
  tenantLabel,
  tenantSublabel,
} from '@/lib/resource-select-presets';

function parseTargetIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const schema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    body: z.string().min(1, 'Body is required'),
    type: z.enum([
      'announcement',
      'emergency',
      'payment_reminder',
      'payment_verified',
      'complaint_update',
      'service_update',
      'electricity_bill',
      'welcome',
      'meal_feedback',
    ]),
    targetType: z.enum(['all', 'floor', 'room', 'individual']),
    targetIds: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.targetType !== 'all' && parseTargetIds(data.targetIds).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetIds'],
        message:
          data.targetType === 'floor'
            ? 'Select at least one floor'
            : data.targetType === 'room'
              ? 'Select at least one room'
              : 'Select at least one tenant',
      });
    }
  });

type FormData = z.infer<typeof schema>;

const typeOptions = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'complaint_update', label: 'Complaint Update' },
  { value: 'service_update', label: 'Service Update' },
  { value: 'electricity_bill', label: 'Electricity Bill' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'meal_feedback', label: 'Meal Feedback' },
];

const targetTypeOptions = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'room', label: 'By Room' },
  { value: 'individual', label: 'Specific Tenant' },
];

export default function EditNotificationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [pickerValue, setPickerValue] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const currentType = useWatch({ control, name: 'type' });
  const currentTarget = useWatch({ control, name: 'targetType' }) ?? 'all';
  const targetIdsRaw = useWatch({ control, name: 'targetIds' }) ?? '';
  const selectedIds = parseTargetIds(targetIdsRaw);

  useEffect(() => {
    if (!id) return;
    api
      .get(`notifications/${id}`)
      .json<{ success: boolean; data: FormData & { _id: string; targetIds?: string | string[] } }>()
      .then((res) => {
        const d = res.data;
        reset({
          title: d.title ?? '',
          body: d.body ?? '',
          type: (d.type as FormData['type']) ?? 'announcement',
          targetType: (d.targetType as FormData['targetType']) ?? 'all',
          targetIds: Array.isArray(d.targetIds) ? d.targetIds.join(', ') : (d.targetIds ?? ''),
        });
        setIsLoading(false);
      })
      .catch(async (err) => {
        const parsed = await parseApiError(err);
        setSubmitError(parsed.message || 'Failed to load notification');
        setIsLoading(false);
      });
  }, [id, reset]);

  const addTargetId = (idToAdd: string) => {
    if (!idToAdd) return;
    const next = selectedIds.includes(idToAdd) ? selectedIds : [...selectedIds, idToAdd];
    setValue('targetIds', next.join(', '), { shouldValidate: true });
    setPickerValue('');
  };

  const removeTargetId = (idToRemove: string) => {
    setValue('targetIds', selectedIds.filter((t) => t !== idToRemove).join(', '), {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = {
      ...data,
      targetIds:
        data.targetType === 'all' ? [] : parseTargetIds(data.targetIds),
    };
    try {
      await api.put(`notifications/${id}`, { json: payload }).json();
      router.push('/notifications');
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(parsed.message || 'Failed to update notification');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Notification"
      description="Update message content and audience targeting"
      backHref="/notifications"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/notifications"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Message content" description="What tenants will see">
          <FormGrid>
            <FormFullWidth>
              <Input
                label="Title"
                placeholder="Notification headline"
                error={err.title?.message}
                leftIcon={<Bell className="h-4 w-4" />}
                {...register('title')}
              />
            </FormFullWidth>
            <FormFullWidth>
              <Textarea
                label="Body"
                rows={4}
                placeholder="Full notification message..."
                error={err.body?.message}
                {...register('body')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>

        <FormSection title="Delivery settings" description="Type and audience targeting" divided>
          <FormGrid>
            <Select
              label="Notification type"
              options={typeOptions}
              error={err.type?.message}
              {...register('type')}
            />
            <Select
              label="Target audience"
              options={targetTypeOptions}
              error={err.targetType?.message}
              {...register('targetType', {
                onChange: () => {
                  setValue('targetIds', '', { shouldValidate: true });
                  setPickerValue('');
                },
              })}
            />
            {currentTarget !== 'all' && (
              <FormFullWidth>
                <div className="space-y-2">
                  <Controller
                    name="targetIds"
                    control={control}
                    render={() => (
                      <>
                        {currentTarget === 'floor' && (
                          <ResourceSelect
                            label="Add floor"
                            endpoint="floors"
                            value={pickerValue}
                            onChange={addTargetId}
                            placeholder="Select a floor..."
                            labelKey={floorLabel}
                            error={err.targetIds?.message}
                            helperText="Required: pick one or more floors."
                          />
                        )}
                        {currentTarget === 'room' && (
                          <ResourceSelect
                            label="Add room"
                            endpoint="rooms?isActive=true"
                            value={pickerValue}
                            onChange={addTargetId}
                            placeholder="Select a room..."
                            labelKey={roomLabel}
                            sublabelFn={roomSublabel}
                            error={err.targetIds?.message}
                            helperText="Required: pick one or more rooms."
                          />
                        )}
                        {currentTarget === 'individual' && (
                          <ResourceSelect
                            label="Add tenant"
                            endpoint="tenants?isActive=true"
                            value={pickerValue}
                            onChange={addTargetId}
                            placeholder="Select a tenant..."
                            valueKey="userId"
                            labelKey={(item) =>
                              tenantLabel(item as Parameters<typeof tenantLabel>[0])
                            }
                            sublabelFn={(item) =>
                              tenantSublabel(item as Parameters<typeof tenantSublabel>[0])
                            }
                            error={err.targetIds?.message}
                            helperText="Required: pick one or more tenants (user IDs)."
                          />
                        )}
                      </>
                    )}
                  />
                  {selectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedIds.map((tid) => (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => removeTargetId(tid)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-danger-300)] hover:text-[color:var(--color-danger-600)]"
                          title="Remove"
                        >
                          <span className="max-w-[12rem] truncate font-[family:var(--font-mono)]">
                            {tid}
                          </span>
                          <span aria-hidden="true">x</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormFullWidth>
            )}
          </FormGrid>

          <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-3 py-2">
            <p className="text-xs font-medium text-[color:var(--color-brand-700)]">
              <Send className="mr-1 inline h-3 w-3" />
              This notification will be sent to{' '}
              {currentTarget === 'all' ? 'all tenants' : `selected ${currentTarget}s`}.
              {currentType === 'emergency' && ' Emergency notifications bypass quiet hours.'}
            </p>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
