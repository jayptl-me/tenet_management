'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building, Hash, DoorOpen, Pencil, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { FloorServiceGrid } from '@/components/ui/FloorServiceGrid';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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

export default function FloorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [floor, setFloor] = useState<FloorDetail | null>(null);
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
  }, [id]);

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !floor) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Floor not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              {floor.label}
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">Floor ID: {floor._id}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/floors/${floor._id}/edit`)}>
          <Pencil className="h-4 w-4" />
          Edit Floor
        </Button>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Label" value={floor.label} icon={<Building className="h-4 w-4" />} variant="default" />
        <StatCard title="Floor Number" value={floor.floorNumber.toString()} icon={<Hash className="h-4 w-4" />} variant="default" />
        <StatCard title="Total Rooms" value={floor.totalRooms.toString()} icon={<DoorOpen className="h-4 w-4" />} variant="default" />
        <StatCard title="Created" value={formatDate(floor.createdAt)} icon={<MapPin className="h-4 w-4" />} variant="default" />
      </motion.div>

      {/* ── Service Health ─────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">Service Health</h3>
        <FloorServiceGrid
          floorId={floor._id}
          floorLabel={floor.label}
          onReportIssue={(serviceType) => {
            router.push(
              `/complaints/new?category=${encodeURIComponent(serviceType)}&floorId=${encodeURIComponent(floor._id)}`,
            );
          }}
        />
      </motion.div>

      {/* ── Amenities ──────────────────────────── */}
      {floor.amenityCounts && floor.amenityCounts.length > 0 && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">Amenities</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {floor.amenityCounts.map((ac: { amenityKey: string; count: number }) => {
              const label = ac.amenityKey
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());
              return (
                <div
                  key={ac.amenityKey}
                  className="flex items-center gap-3 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4 shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)]"
                >
                  <div className="text-2xl font-bold text-[color:var(--color-text-primary)]">{ac.count}</div>
                  <div>
                    <p className="text-sm font-bold text-[color:var(--color-text-primary)]">{label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Description ─────────────────────────── */}
      {floor.description && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">Description</h3>
          <p className="whitespace-pre-wrap text-sm text-[color:var(--color-text-secondary)]">{floor.description}</p>
        </motion.div>
      )}
    </motion.div>
  );
}