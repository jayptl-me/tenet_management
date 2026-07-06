'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { IAppConfigPublic } from '@pg/types';

export const DEFAULT_CONFIG: Partial<IAppConfigPublic> = {
  pgName: 'Tenet PG',
  tagline: 'Your home, your space.',
  amenities: [
    'High-Speed WiFi',
    'Washing Machine',
    'Fridge',
    'RO Water',
    'Housekeeping',
    '24/7 Security',
  ],
  roomPricing: {
    sharing2: 8000,
    sharing3: 6500,
    sharing4: 5000,
  },
  primaryColor: '#f59e0b',
  landingHeroHeadline: 'Premium PG Living, Effortlessly Managed',
  landingHeroSubline:
    'Safe, comfortable, and well-managed paying guest accommodations with transparent billing, real-time updates, and zero hassle.',
  testimonials: [
    {
      name: 'Rahul Sharma',
      occupation: 'Software Engineer',
      rating: 5,
      quote: 'Best PG experience in Bangalore! Super clean rooms, and the food is great.',
    },
    {
      name: 'Priya Mehta',
      occupation: 'Product Designer',
      rating: 4,
      quote:
        'Highly recommend! The management is very responsive, and the amenities are well-maintained.',
    },
  ],
};

export function useAppConfigPublic() {
  return useQuery({
    queryKey: ['appConfig', 'public'],
    queryFn: () =>
      api
        .get('app-config')
        .json<{ success: boolean; data: IAppConfigPublic }>()
        .then((res) => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_CONFIG as IAppConfigPublic,
  });
}
