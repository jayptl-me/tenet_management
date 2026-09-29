'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
  Plus,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatCard } from '@/components/ui/StatCard';
import { DonutChart } from '@/components/ui/DonutChart';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { QuickBedAssignModal, type BedAssignTarget } from '@/components/admin/QuickBedAssignModal';

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

const occupiedBedColumns: DataTableColumn<BedDetail>[] = [
  {
    header: 'Bed',
    accessor: (bed) => (
      <span className="font-mono text-sm font-bold text-(--color-text-primary)">{bed.bedId}</span>
    ),
    className: 'w-[120px]',
  },
  {
    header: 'Tenant',
    accessor: (bed) =>
      bed.tenantId ? (
        <Link
          href={`/tenants/${bed.tenantId}`}
          className="font-semibold text-(--color-brand-600) underline-offset-2 hover:underline"
        >
          {bed.tenantName ?? 'View tenant'}
        </Link>
      ) : (
        <span className="font-semibold text-(--color-text-primary)">{bed.tenantName ?? 'N/A'}</span>
      ),
  },
  {
    header: 'Status',
    accessor: () => <StatusBadge variant="success" label="Occupied" />,
    className: 'text-right w-[100px]',
  },
];

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignBedTarget, setAssignBedTarget] = useState<BedAssignTarget | null>(null);

  const fetchRoom = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`rooms/${id}`)
      .json<{ success: boolean; data: RoomDetail }>()
      .then((res) => setRoom(res.data))
      .catch(async (err) => {
        setError((await parseApiError(err)).message);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

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
          <Button variant="outline" size="sm" onClick={() => router.push(`/rooms/${id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {room && (
        <div className="space-y-6">
          {room.floor && (room.floor._id || room.floor.id) && (
            <p className="text-sm font-medium text-(--color-text-muted)">
              Floor:{' '}
              <button
                type="button"
                className="font-semibold text-(--color-brand-600) hover:underline"
                onClick={() => router.push(`/floors/${room.floor!._id ?? room.floor!.id}`)}
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
                      <CheckCircle2 className="h-4 w-4 text-(--color-brand-500)" />
                      <span className="font-semibold text-(--color-text-primary)">
                        {occupiedBeds} Occupied
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-(--color-success-500)" />
                      <span className="font-semibold text-(--color-text-primary)">
                        {availableBeds} Available
                      </span>
                    </div>
                    <div className="text-2xs pt-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                      {totalBeds} Total Beds
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-(--color-text-muted)">
                No bed data available
              </p>
            )}
          </DetailCard>

          {room.beds && room.beds.filter((b) => b.isOccupied).length > 0 && (
            <DetailCard title="Current Tenants" icon={<User />}>
              <DataTable
                columns={occupiedBedColumns}
                data={room.beds.filter((b) => b.isOccupied)}
                keyExtractor={(bed) => bed.bedId}
              />
            </DetailCard>
          )}

          <DetailCard title="Bed Allocations" icon={<Bed />}>
            {room.beds && room.beds.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {room.beds.map((bed) => (
                  <div
                    key={bed.bedId}
                    className={`rounded-(--radius-lg) border p-4 transition-all duration-(--transition-duration) ${
                      bed.isOccupied
                        ? 'border-(--border-color) bg-(--color-field-bg) shadow-(--shadow-sm)'
                        : 'border-(--color-success-200) bg-(--color-success-50) shadow-(--shadow-sm)'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-(--color-text-primary)">
                        {bed.bedId}
                      </span>
                      <StatusBadge
                        variant={bed.isOccupied ? 'warning' : 'success'}
                        label={bed.isOccupied ? 'Occupied' : 'Available'}
                      />
                    </div>
                    {bed.isOccupied ? (
                      bed.tenantId ? (
                        <Link
                          href={`/tenants/${bed.tenantId}`}
                          className="block truncate text-xs font-semibold text-(--color-brand-600) underline-offset-2 hover:underline"
                        >
                          {bed.tenantName ?? 'View tenant'}
                        </Link>
                      ) : (
                        <p className="truncate text-xs font-semibold text-(--color-text-secondary)">
                          {bed.tenantName ?? 'Occupied'}
                        </p>
                      )
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setAssignBedTarget({
                              roomId: room._id,
                              roomNumber: room.roomNumber,
                              bedId: bed.bedId,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                        >
                          <UserPlus className="h-3 w-3" />
                          Assign Existing
                        </button>
                        <span className="text-(--color-text-muted)">&middot;</span>
                        <Link
                          href={`/tenants/new?roomId=${room._id}&bedId=${bed.bedId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-(--color-success-700) underline-offset-2 hover:underline"
                        >
                          <Plus className="h-3 w-3" />
                          New Intake
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-(--color-text-muted)">
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

          {/* In-room appliance and amenity status */}
          {room.roomAmenities && room.roomAmenities.length > 0 && (
            <DetailCard title="In-Room Amenities & Appliance Health" icon={<CheckCircle2 />}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {room.roomAmenities.map((amenity) => {
                  const statusVariant =
                    amenity.status === 'operational'
                      ? 'success'
                      : amenity.status === 'degraded'
                        ? 'warning'
                        : 'danger';
                  return (
                    <div
                      key={amenity.amenityKey}
                      className="flex items-center justify-between rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3 shadow-(--shadow-sm)"
                    >
                      <span className="text-xs font-semibold text-(--color-text-primary) capitalize">
                        {amenity.amenityKey.replace(/_/g, ' ')}
                      </span>
                      <StatusBadge
                        variant={statusVariant}
                        label={amenity.status.charAt(0).toUpperCase() + amenity.status.slice(1)}
                      />
                    </div>
                  );
                })}
              </div>
            </DetailCard>
          )}

          {/* Floor-scoped service health with report-issue wiring (replaces the
              abstract amenity stacked bar; per-room amenity states remain in
              the room edit form). */}
          {room.floor?._id && (
            <DetailCard title="Floor Service Health" icon={<CheckCircle2 />}>
              <FloorServiceGrid
                floorId={room.floor._id}
                floorLabel={room.floor.label}
                onReportIssue={(serviceType) => {
                  router.push(
                    `/complaints/new?category=${encodeURIComponent(serviceType)}&roomId=${encodeURIComponent(room._id)}`,
                  );
                }}
              />
            </DetailCard>
          )}

          {room.description && (
            <DetailCard title="Notes" icon={<FileText />} variant="warning">
              <p className="text-sm font-medium text-(--color-text-secondary)">
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
                    className="block aspect-square overflow-hidden rounded-(--radius-lg) border border-(--border-color) shadow-(--shadow-sm) transition-all duration-(--transition-duration)"
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
                            'bg-(--color-field-bg)',
                          );
                          t.parentElement.innerHTML =
                            '<svg class="h-8 w-8 text-(--color-text-muted)" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
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

      <QuickBedAssignModal
        target={assignBedTarget}
        onClose={() => setAssignBedTarget(null)}
        onSuccess={() => fetchRoom()}
      />
    </FormPage>
  );
}
