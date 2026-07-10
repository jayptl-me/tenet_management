'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

const complaintSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  roomId: z.string().min(1, 'Room is required'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum([
    'wifi',
    'water',
    'electricity',
    'food_quality',
    'cleaning_room',
    'cleaning_washroom',
    'washing_machine',
    'fridge',
    'lights',
    'noise',
    'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type ComplaintFormData = z.infer<typeof complaintSchema>;

interface Tenant {
  _id: string;
  user?: { name: string };
  name?: string;
  roomId?: string | { _id: string; roomNumber: string };
}

interface Room {
  _id: string;
  roomNumber: string;
  floorId?: string | { _id: string };
}

const CATEGORY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'cleaning_room', label: 'Cleaning - Room' },
  { value: 'cleaning_washroom', label: 'Cleaning - Washroom' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'lights', label: 'Lights' },
  { value: 'noise', label: 'Noise' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function ComplaintForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCategory = searchParams.get('category') || '';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
  } = useForm<ComplaintFormData>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      tenantId: '',
      roomId: '',
      title: '',
      description: '',
      category: 'other',
      priority: 'medium',
    },
  });

  // Set prefilled category from search params
  useEffect(() => {
    if (prefilledCategory) {
      const validCategories = [
        'wifi',
        'water',
        'electricity',
        'food_quality',
        'cleaning_room',
        'cleaning_washroom',
        'washing_machine',
        'fridge',
        'lights',
        'noise',
        'other',
      ];
      if (validCategories.includes(prefilledCategory)) {
        setValue('category', prefilledCategory as ComplaintFormData['category']);
      }
    }
  }, [prefilledCategory, setValue]);

  const selectedTenantId = useWatch({ control, name: 'tenantId' });

  useEffect(() => {
    api
      .get('tenants')
      .json<{ success: boolean; data: Tenant[] }>()
      .then((res) => {
        setTenants(res.data);
      })
      .catch(() => {
        toast.error('Failed to load tenants');
      })
      .finally(() => {
        setIsLoadingTenants(false);
      });
  }, []);

  useEffect(() => {
    api
      .get('rooms')
      .json<{ success: boolean; data: Room[] }>()
      .then((res) => {
        setRooms(res.data);
      })
      .catch(() => {
        toast.error('Failed to load rooms');
      })
      .finally(() => {
        setIsLoadingRooms(false);
      });
  }, []);

  useEffect(() => {
    if (selectedTenantId && tenants.length > 0) {
      const selectedTenant = tenants.find((t) => t._id === selectedTenantId);
      if (selectedTenant?.roomId) {
        const roomId =
          typeof selectedTenant.roomId === 'string'
            ? selectedTenant.roomId
            : selectedTenant.roomId._id;
        setValue('roomId', roomId);
      }
    }
  }, [selectedTenantId, tenants, setValue]);

  const onSubmit = async (data: ComplaintFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('complaints', { json: data }).json();
      toast.success('Complaint submitted successfully');
      router.push('/complaints');
    } catch {
      toast.error('Failed to submit complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTenantName = (t: Tenant) => t.name || t.user?.name || t._id;

  const tenantOptions = tenants.map((t) => ({
    value: t._id,
    label: getTenantName(t),
  }));

  const roomOptions = rooms.map((r) => ({
    value: r._id,
    label: r.roomNumber,
  }));

  return (
    <FormPage title="New Complaint" description="Report an issue" backHref="/complaints">
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/complaints"
            submitLabel="Submit Complaint"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Select
            label="Tenant"
            options={isLoadingTenants ? [] : tenantOptions}
            placeholder={isLoadingTenants ? 'Loading tenants...' : 'Select a tenant'}
            error={errors.tenantId?.message}
            disabled={isLoadingTenants}
            {...register('tenantId')}
          />

          <Select
            label="Room"
            options={isLoadingRooms ? [] : roomOptions}
            placeholder={isLoadingRooms ? 'Loading rooms...' : 'Select a room'}
            error={errors.roomId?.message}
            disabled={isLoadingRooms}
            {...register('roomId')}
          />

          <FormGrid>
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              error={errors.category?.message}
              {...register('category')}
            />
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              error={errors.priority?.message}
              {...register('priority')}
            />
          </FormGrid>

          <Input
            label="Title"
            placeholder="Brief title for the complaint"
            error={errors.title?.message}
            {...register('title')}
          />

          <Textarea
            label="Description"
            rows={4}
            placeholder="Describe the issue in detail"
            error={errors.description?.message}
            {...register('description')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}

export default function NewComplaintPage() {
  return (
    <Suspense
      fallback={
        <FormPage
          title="New Complaint"
          description="Report an issue"
          backHref="/complaints"
          isLoading
        >
          {null}
        </FormPage>
      }
    >
      <ComplaintForm />
    </Suspense>
  );
}
