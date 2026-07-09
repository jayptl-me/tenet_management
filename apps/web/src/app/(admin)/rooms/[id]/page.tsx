'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Home,
  Building,
  Users,
  Banknote,
  Bed,
  Pencil,
  User,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { DonutChart } from '@/components/ui/DonutChart';
import { StackedBarChart } from '@/components/ui/StackedBarChart';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

interface BedDetail {
  bedId: string;
  isOccupied: boolean;
  tenantId?: string | null;
  tenantName?: string;
}

interface RoomAmenityStatusDoc {
  amenityKey: string;
  status: string;
}

interface RoomDetail {
  _id: string;
  roomNumber: string;
  floor?: { _id?: string; id?: string; label: string; floorNumber?: number };
  sharingType: number;
  monthlyRent: number;
  description?: string;
  isActive: boolean;
  photos?: string[];
  beds?: BedDetail[];
  roomAmenities?: RoomAmenityStatusDoc[];
  createdAt: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`rooms/${id}`)
      .json<{ success: boolean; data: RoomDetail }>()
      .then((res) => setRoom(res.data))
      .catch(() => setError('Failed to load room details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!isLoading && (error || !room)) {
    return (
      <FormPage
        title="Room Details"
        description="View room information"
        backHref="/rooms"
        error={error || 'Room not found'}
        maxWidth="4xl"
      />
    );
  }

  const totalBeds = room?.beds?.length ?? 0;
  const occupiedBeds = room?.beds?.filter((b) => b.isOccupied).length ?? 0;
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const amenityOperational =
    room?.roomAmenities?.filter((a) => a.status === 'operational').length ?? 0;
  const amenityDegraded =
    room?.roomAmenities?.filter((a) => a.status === 'degraded').length ?? 0;
  const amenityDown = room?.roomAmenities?.filter((a) => a.status === 'down').length ?? 0;

  const floorDescription = room
    ? room.floor?._id || room.floor?.id
      ? `${room.floor.label ?? 'Floor'} · ${room.sharingType} Sharing`
      : `${room.floor?.label ?? 'No floor'} · ${room.sharingType} Sharing`
    : undefined;

  return (
    <FormPage
      title={room ? `Room ${room.roomNumber}` : 'Room Details'}
      description={floorDescription}
      backHref="/rooms"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        room ? (
          <StatusBadge
            variant={statusToVariant(room.isActive ? 'active' : 'inactive')}
            label={room.isActive ? 'Active' : 'Inactive'}
          />
        ) : undefined
      }
      actions={
        room ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/rooms/${id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {room && (
        <div className="space-y-6">
          {room.floor && (room.floor._id || room.floor.id) && (
            <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
              Floor:{' '}
              <button
                type="button"
                className="font-semibold text-[color:var(--color-brand-600)] hover:underline"
                onClick={() =>
                  router.push(`/floors/${room.floor!._id ?? room.floor!.id}`)
                }
              >
                {room.floor.label ?? 'Floor'}
              </button>
              {' · '}
              {room.sharingType} Sharing
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Monthly Rent"
              value={formatCurrency(room.monthlyRent)}
              icon={<Banknote className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Total Beds"
              value={totalBeds.toString()}
              icon={<Bed className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Available"
              value={availableBeds.toString()}
              icon={<Users className="h-4 w-4" />}
              variant={availableBeds > 0 ? 'success' : 'warning'}
            />
            <StatCard
              title="Occupancy"
              value={`${occupancyPct}%`}
              icon={<Home className="h-4 w-4" />}
              variant="brand"
            />
          </div>

          <DetailCard title="Bed Occupancy" icon={<Users />}>
            {room.beds && room.beds.length > 0 ? (
              <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-8">
                <DonutChart
                  segments={[
                    {
                      value: occupiedBeds,
                      color: 'var(--color-brand-500)',
                      label: 'Occupied',
                    },
                    {
                      value: availableBeds,
                      color: 'var(--color-success-400)',
                      label: 'Available',
                    },
                  ]}
                  centerLabel={`${occupancyPct}%`}
                  sublabel="Occupied"
                  size={160}
                  thickness={28}
                />
                <div className="mt-4 sm:mt-0 sm:self-center">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                      <span className="font-semibold text-[color:var(--color-text-primary)]">
                        {occupiedBeds} Occupied
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success-500)]" />
                      <span className="font-semibold text-[color:var(--color-text-primary)]">
                        {availableBeds} Available
                      </span>
                    </div>
                    <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      {totalBeds} Total Beds
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-[color:var(--color-text-muted)]">
                No bed data available
              </p>
            )}
          </DetailCard>

          {room.beds && room.beds.filter((b) => b.isOccupied).length > 0 && (
            <DetailCard title="Current Tenants" icon={<User />}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border-color)]">
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Bed
                      </th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Tenant
                      </th>
                      <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-color)]">
                    {room.beds
                      .filter((b) => b.isOccupied)
                      .map((bed) => (
                        <tr key={bed.bedId}>
                          <td className="py-3 font-mono text-sm font-bold text-[color:var(--color-text-primary)]">
                            {bed.bedId}
                          </td>
                          <td className="py-3 font-semibold text-[color:var(--color-text-primary)]">
                            {bed.tenantName ?? 'N/A'}
                          </td>
                          <td className="py-3 text-right">
                            <StatusBadge variant="success" label="Occupied" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </DetailCard>
          )}

          <DetailCard title="Bed Allocations" icon={<Bed />}>
            {room.beds && room.beds.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {room.beds.map((bed) => (
                  <div
                    key={bed.bedId}
                    className={`rounded-[var(--radius-lg)] border p-4 transition-all duration-[var(--transition-duration)] ${
                      bed.isOccupied
                        ? 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] shadow-[var(--shadow-sm)]'
                        : 'border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] shadow-[var(--shadow-sm)]'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-[color:var(--color-text-primary)]">
                        {bed.bedId}
                      </span>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          bed.isOccupied
                            ? 'border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]'
                            : 'border-[color:var(--color-success-200)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]'
                        }`}
                      >
                        {bed.isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </div>
                    {bed.isOccupied && (
                      <p className="truncate text-xs font-semibold text-[color:var(--color-text-secondary)]">
                        {bed.tenantName ?? 'Occupied'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[color:var(--color-text-muted)]">
                No bed information available
              </p>
            )}
          </DetailCard>

          {room.floor && (
            <DetailCard title="Floor Details" icon={<Building />}>
              <DetailList>
                <DetailRow label="Label" value={room.floor.label} />
                {room.floor.floorNumber != null && (
                  <DetailRow label="Floor #" value={room.floor.floorNumber} />
                )}
              </DetailList>
            </DetailCard>
          )}

          {room.roomAmenities && room.roomAmenities.length > 0 && (
            <DetailCard title="Room Amenities Status" icon={<CheckCircle2 />}>
              <StackedBarChart
                bars={[
                  {
                    label: 'Amenities',
                    segments: [
                      {
                        value: amenityOperational,
                        color: 'var(--color-success-500)',
                        label: 'Operational',
                      },
                      {
                        value: amenityDegraded,
                        color: 'var(--color-warning-500)',
                        label: 'Degraded',
                      },
                      {
                        value: amenityDown,
                        color: 'var(--color-danger-500)',
                        label: 'Down',
                      },
                    ],
                  },
                ]}
                barHeight={36}
              />
            </DetailCard>
          )}

          {room.description && (
            <DetailCard title="Notes" icon={<FileText />} variant="warning">
              <p className="text-sm font-medium text-[color:var(--color-text-secondary)]">
                {room.description}
              </p>
            </DetailCard>
          )}

          {room.photos && room.photos.length > 0 && (
            <DetailCard title="Photos" icon={<ImageIcon />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {room.photos.map((photo, index) => (
                  <a
                    key={index}
                    href={photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)]"
                  >
                    <img
                      src={photo}
                      alt={`Room ${room.roomNumber} photo ${index + 1}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const t = e.currentTarget;
                        t.style.display = 'none';
                        if (t.parentElement) {
                          t.parentElement.classList.add(
                            'flex',
                            'items-center',
                            'justify-center',
                            'bg-[color:var(--color-field-bg)]',
                          );
                          t.parentElement.innerHTML =
                            '<svg class="h-8 w-8 text-[color:var(--color-text-muted)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                        }
                      }}
                    />
                  </a>
                ))}
              </div>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
