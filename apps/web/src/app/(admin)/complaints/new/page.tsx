'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

const complaintSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  roomId: z.string().min(1, 'Room is required'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum([
    'wifi', 'water', 'electricity', 'food_quality', 'cleaning_room',
    'cleaning_washroom', 'washing_machine', 'fridge', 'lights', 'noise', 'other',
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

function ComplaintForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCategory = searchParams.get('category') || '';
  const prefilledFloorId = searchParams.get('floorId') || '';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
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
        'wifi', 'water', 'electricity', 'food_quality', 'cleaning_room',
        'cleaning_washroom', 'washing_machine', 'fridge', 'lights', 'noise', 'other',
      ];
      if (validCategories.includes(prefilledCategory)) {
        setValue('category', prefilledCategory as ComplaintFormData['category']);
      }
    }
  }, [prefilledCategory, setValue]);

  const selectedTenantId = watch('tenantId');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            New Complaint
          </h2>
          <p className="text-surface-500 text-sm">Report an issue</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Tenant */}
          <div>
            <label htmlFor="tenantId" className="text-surface-800 font-display mb-1.5 block text-sm font-semibold">
              Tenant <span className="text-danger-500">*</span>
            </label>
            {isLoadingTenants ? (
              <div className="border-t-brand-500 h-5 w-5 animate-spin rounded-full border-[length:var(--bw-default)]" />
            ) : (
              <select
                id="tenantId"
                {...register('tenantId')}
                className="w-full rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm"
              >
                <option value="">Select a tenant</option>
                {tenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {getTenantName(t)}
                  </option>
                ))}
              </select>
            )}
            {errors.tenantId && (
              <p className="text-danger-600 mt-1 text-xs font-medium">{errors.tenantId.message}</p>
            )}
          </div>

          {/* Room */}
          <div>
            <label htmlFor="roomId" className="text-surface-800 font-display mb-1.5 block text-sm font-semibold">
              Room <span className="text-danger-500">*</span>
            </label>
            {isLoadingRooms ? (
              <div className="border-t-brand-500 h-5 w-5 animate-spin rounded-full border-[length:var(--bw-default)]" />
            ) : (
              <select
                id="roomId"
                {...register('roomId')}
                className="w-full rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm"
              >
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.roomNumber}
                  </option>
                ))}
              </select>
            )}
            {errors.roomId && (
              <p className="text-danger-600 mt-1 text-xs font-medium">{errors.roomId.message}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="text-surface-800 font-display mb-1.5 block text-sm font-semibold">
              Category <span className="text-danger-500">*</span>
            </label>
            <select
              id="category"
              {...register('category')}
              className="w-full rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm"
            >
              <option value="">Select a category</option>
              <option value="wifi">Wi-Fi</option>
              <option value="water">Water</option>
              <option value="electricity">Electricity</option>
              <option value="food_quality">Food Quality</option>
              <option value="cleaning_room">Cleaning - Room</option>
              <option value="cleaning_washroom">Cleaning - Washroom</option>
              <option value="washing_machine">Washing Machine</option>
              <option value="fridge">Fridge</option>
              <option value="lights">Lights</option>
              <option value="noise">Noise</option>
              <option value="other">Other</option>
            </select>
            {errors.category && (
              <p className="text-danger-600 mt-1 text-xs font-medium">{errors.category.message}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="text-surface-800 font-display mb-1.5 block text-sm font-semibold">
              Priority <span className="text-danger-500">*</span>
            </label>
            <select
              id="priority"
              {...register('priority')}
              className="w-full rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            {errors.priority && (
              <p className="text-danger-600 mt-1 text-xs font-medium">{errors.priority.message}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="text-surface-800 font-display mb-1.5 block text-sm font-semibold">
              Title <span className="text-danger-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              {...register('title')}
              placeholder="Brief title for the complaint"
              className="w-full rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm placeholder:text-surface-400"
            />
            {errors.title && (
              <p className="text-danger-600 mt-1 text-xs font-medium">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="text-surface-800 font-display mb-1.5 block text-sm font-semibold">
              Description <span className="text-danger-500">*</span>
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={4}
              placeholder="Describe the issue in detail"
              className="w-full rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm placeholder:text-surface-400 resize-y"
            />
            {errors.description && (
              <p className="text-danger-600 mt-1 text-xs font-medium">{errors.description.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Send className="h-4 w-4" />
              Submit Complaint
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewComplaintPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
        </div>
      }
    >
      <ComplaintForm />
    </Suspense>
  );
}
