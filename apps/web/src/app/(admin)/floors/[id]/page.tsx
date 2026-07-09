'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Building,
  Hash,
  DoorOpen,
  Pencil,
  MapPin,
  Loader2,
  BedDouble,
  Banknote,
  Users,
  FileText,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard } from '@/components/ui/DetailCard';

interface FloorDetail {
  _id: string;
  label: string;
  floorNumber: number;
  description?: string;
  totalRooms: number;
  amenityCounts?: Array<{ amenityKey: string; count: number }>;
  amenities?: {
    washingMachines?: number;
    fridges?: number;
  };
  createdAt: string;
}

interface RoomListing {
  _id: string;
  roomNumber: string;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  beds?: Array<{ bedId: string; isOccupied: boolean; tenantName?: string }>;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

export default function FloorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`floors/${id}`)
      .json<{ success: boolean; data: FloorDetail }>()
      .then((res) => {
        setFloor(res.data);
      })
      .catch(() => {
        setError('Failed to load floor details');
      })
      .finally(() => {
        setIsLoading(false);
      });

    setRoomsLoading(true);
    api
      .get(`rooms?floorId=${id}&limit=100`)
      .json<{ success: boolean; data: RoomListing[] }>()
      .then((res) => setRooms(res.data))
      .catch(() => {})
      .finally(() => setRoomsLoading(false));
  }, [id]);

  if (!isLoading && (error || !floor)) {
    return (
      <FormPage
        title="Floor Details"
        description="View floor information"
        backHref="/floors"
        error={error || 'Floor not found'}
        maxWidth="4xl"
      />
    );
  }

  return (
    <FormPage
      title={floor?.label ?? 'Floor Details'}
      description={floor ? `Floor ID: ${floor._id}` : 'View floor information'}
      backHref="/floors"
      isLoading={isLoading}
      maxWidth="4xl"
      actions={
        floor ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/floors/${floor._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit Floor
          </Button>
        ) : undefined
      }
    >
      {floor && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Label"
              value={floor.label}
              icon={<Building className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Floor Number"
              value={floor.floorNumber.toString()}
              icon={<Hash className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Total Rooms"
              value={floor.totalRooms.toString()}
              icon={<DoorOpen className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Created"
              value={formatDate(floor.createdAt)}
              icon={<MapPin className="h-4 w-4" />}
              variant="default"
            />
          </div>

          <DetailCard title="Service Health" icon={<Wrench />}>
            <FloorServiceGrid
              floorId={floor._id}
              floorLabel={floor.label}
              onReportIssue={(serviceType) => {
                router.push(
                  `/complaints/new?category=${encodeURIComponent(serviceType)}&floorId=${encodeURIComponent(floor._id)}`,
                );
              }}
            />
          </DetailCard>

          {floor.amenityCounts && floor.amenityCounts.length > 0 && (
            <DetailCard title="Amenities" icon={<Building />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {floor.amenityCounts.map((ac: { amenityKey: string; count: number }) => {
                  const label = ac.amenityKey
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                  return (
                    <div
                      key={ac.amenityKey}
                      className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-4"
                    >
                      <div className="text-2xl font-bold text-[color:var(--color-text-primary)]">
                        {ac.count}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[color:var(--color-text-primary)]">
                          {label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DetailCard>
          )}

          <DetailCard title="Rooms on this Floor" icon={<BedDouble />}>
            {roomsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--color-text-muted)]" />
              </div>
            ) : rooms.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border-color)] text-left">
                      <th className="pb-3 pr-4 font-[family:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Room #
                      </th>
                      <th className="pb-3 pr-4 font-[family:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Sharing
                      </th>
                      <th className="pb-3 pr-4 font-[family:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Rent
                      </th>
                      <th className="pb-3 pr-4 font-[family:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Occupancy
                      </th>
                      <th className="pb-3 pr-4 font-[family:var(--font-display)] text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => {
                      const totalBeds = room.beds?.length ?? 0;
                      const occupiedBeds =
                        room.beds?.filter((b) => b.isOccupied).length ?? 0;
                      return (
                        <tr
                          key={room._id}
                          onClick={() => router.push(`/rooms/${room._id}`)}
                          className="cursor-pointer border-b border-[color:var(--border-color)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-field-bg)] last:border-b-0"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <BedDouble className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                              <span className="font-semibold text-[color:var(--color-text-primary)]">
                                {room.roomNumber}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-[color:var(--color-text-secondary)]">
                            {room.sharingType} Sharing
                          </td>
                          <td className="py-3 pr-4 text-[color:var(--color-text-secondary)]">
                            <Banknote className="mr-1 inline h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                            {formatCurrency(room.monthlyRent)}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                              <span
                                className={`text-xs font-bold ${
                                  occupiedBeds === totalBeds
                                    ? 'text-[color:var(--color-danger-600)]'
                                    : occupiedBeds > 0
                                      ? 'text-[color:var(--color-warning-600)]'
                                      : 'text-[color:var(--color-success-600)]'
                                }`}
                              >
                                {occupiedBeds}/{totalBeds}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge
                              variant={statusToVariant(
                                room.isActive ? 'active' : 'inactive',
                              )}
                              label={room.isActive ? 'Active' : 'Inactive'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<BedDouble className="h-10 w-10" />}
                title="No rooms on this floor"
                description="Add a room to start managing this floor"
                action={{
                  label: 'Add Room',
                  onClick: () => router.push(`/rooms/new?floorId=${floor._id}`),
                }}
              />
            )}
          </DetailCard>

          {floor.description && (
            <DetailCard title="Description" icon={<FileText />}>
              <p className="whitespace-pre-wrap text-sm text-[color:var(--color-text-secondary)]">
                {floor.description}
              </p>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
