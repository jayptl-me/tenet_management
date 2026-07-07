'use client';

import { useState, useEffect } from 'react';
import { Wifi, Zap, Droplets, Thermometer, Shirt, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

interface ServiceInfo {
  serviceType: string;
  status: string;
}

interface ServiceStatusIndicatorProps {
  floorId?: string;
  compact?: boolean;
}

const serviceIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-3.5 w-3.5" />,
  electricity: <Zap className="h-3.5 w-3.5" />,
  water_supply: <Droplets className="h-3.5 w-3.5" />,
  washing_machine_1: <Shirt className="h-3.5 w-3.5" />,
  washing_machine_2: <Shirt className="h-3.5 w-3.5" />,
  fridge: <Sparkles className="h-3.5 w-3.5" />,
  geyser: <Thermometer className="h-3.5 w-3.5" />,
};

const serviceLabels: Record<string, string> = {
  wifi: 'WiFi',
  electricity: 'Power',
  water_supply: 'Water',
  washing_machine_1: 'WM 1',
  washing_machine_2: 'WM 2',
  fridge: 'Fridge',
  geyser: 'Geyser',
};

const statusColors: Record<string, string> = {
  operational: 'text-success-500',
  degraded: 'text-warning-500',
  down: 'text-danger-500',
};

const statusBg: Record<string, string> = {
  operational: 'bg-success-100',
  degraded: 'bg-warning-100',
  down: 'bg-danger-100',
};

export function ServiceStatusIndicator({ floorId, compact = false }: ServiceStatusIndicatorProps) {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!floorId) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ floorId, limit: '20' });
    api
      .get(`services?${params}`)
      .json<{ success: boolean; data: ServiceInfo[] }>()
      .then((res) => {
        setServices(res.data);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setLoading(false));
  }, [floorId]);

  if (loading || !floorId) return null;

  // Key essential services to show: wifi, electricity, water_supply
  const essentialTypes = ['wifi', 'electricity', 'water_supply'];
  const keyServices = services.filter((s) => essentialTypes.includes(s.serviceType));

  if (keyServices.length === 0) return null;

  if (compact) {
    const allOk = keyServices.every((s) => s.status === 'operational');
    const anyDown = keyServices.some((s) => s.status === 'down');

    return (
      <div
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${
          anyDown ? 'bg-danger-100 text-danger-700' : allOk ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
        }`}
        title={keyServices.map((s) => `${serviceLabels[s.serviceType] ?? s.serviceType}: ${s.status}`).join(', ')}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            anyDown ? 'bg-danger-500' : allOk ? 'bg-success-500' : 'bg-warning-500'
          }`}
        />
        {anyDown ? 'Service Issue' : allOk ? 'All OK' : 'Degraded'}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {keyServices.map((s) => (
        <div
          key={s.serviceType}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${statusBg[s.status] ?? 'bg-surface-100'} ${statusColors[s.status] ?? 'text-surface-600'}`}
          title={`${serviceLabels[s.serviceType] ?? s.serviceType}: ${s.status}`}
        >
          {serviceIcons[s.serviceType] ?? <Wifi className="h-3 w-3" />}
          <span className="hidden sm:inline">
            {serviceLabels[s.serviceType] ?? s.serviceType}
          </span>
        </div>
      ))}
    </div>
  );
}
