'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Menu,
  X,
  Phone,
  MapPin,
  Star,
  Shield,
  Zap,
  Users,
  Send,
  Check,
  Mail,
  Instagram,
  Facebook,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { IAppConfigPublic } from '@pg/types';

const DEFAULT_CONFIG: Partial<IAppConfigPublic> = {
  pgName: 'Apex PG',
  tagline: 'Your home, your space.',
  amenities: [
    'High-Speed WiFi',
    'Washing Machine',
    'Fridge',
    'RO Water',
    'Housekeeping',
    '24/7 Security',
  ],
  roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
  landingHeroHeadline: 'Premium PG Living, Effortlessly Managed',
  landingHeroSubline:
    'Safe, comfortable, and well-managed paying guest accommodations with transparent billing, real-time updates, and zero hassle.',
  testimonials: [
    { name: 'Rahul Sharma', occupation: 'Software Engineer', rating: 5, quote: 'Best PG experience in Bangalore! Super clean rooms, and the food is great.' },
    { name: 'Priya Mehta', occupation: 'Product Designer', rating: 4, quote: 'Highly recommend! The management is very responsive, and the amenities are well-maintained.' },
  ],
};

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [config, setConfig] = useState<IAppConfigPublic | null>(null);

  // Fetch public app config
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'}/app-config`)
      .then(r => r.json())
      .then(res => { if (res.success) setConfig(res.data); })
      .catch(() => {});
  }, []);

  // Dynamically resolve configuration and fallbacks
  const pgName = config?.pgName || 'Apex PG';
  const tagline = config?.tagline || 'Your home, your space.';
  const headline = config?.landingHeroHeadline || 'Premium PG Living, Effortlessly Managed';
  const subline =
    config?.landingHeroSubline ||
    'Safe, comfortable, and well-managed paying guest accommodations with transparent billing, real-time updates, and zero hassle.';
  const phone = config?.phone || '+91 98765 43210';
  const email = config?.email || 'hello@apexpg.com';
  const address = config?.address || {
    line1: '123 Main Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
  };
  const amenities =
    config?.amenities && config.amenities.length > 0
      ? config.amenities
      : [
          'High-Speed WiFi',
          'Washing Machine',
          'Fridge',
          'RO Water',
          'Housekeeping',
          '24/7 Security',
        ];
  const roomPricing = config?.roomPricing || { sharing2: 8000, sharing3: 6500, sharing4: 5000 };
  const testimonials =
    config?.testimonials && config.testimonials.length > 0
      ? config.testimonials
      : [
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
        ];
  const mapsEmbedUrl = config?.googleMapsEmbedUrl;
  const social = config?.socialLinks;

  // Custom JSON-LD schema based on database config
  const customJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: pgName,
    description: tagline,
    image: config?.heroImageUrl || 'https://apexpg.com/og-image.png',
    url: 'https://apexpg.com',
    telephone: phone,
    email: email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${address.line1}${address.line2 ? `, ${address.line2}` : ''}`,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.pincode,
      addressCountry: 'IN',
    },
    priceRange: `₹${roomPricing.sharing4} - ₹${roomPricing.sharing2}`,
    amenityFeature: amenities.map((a) => ({
      '@type': 'LocationFeatureSpecification',
      name: a,
    })),
  };

  const handleEnquireClick = (sharingType: string) => {
    setMessageText(
      `Hi, I am interested in checking availability for a ${sharingType} sharing room.`,
    );
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEnquiry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
      source: 'website',
    };

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
      const res = await fetch(`${API_BASE}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setFormSent(true);
      form.reset();
    } catch {
      setFormError('Something went wrong. Please try again or call us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-50 font-[family:var(--font-body)] text-surface-900 min-h-screen transition-colors duration-[var(--transition-duration)]">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(customJsonLd) }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] bg-[color:var(--color-surface-100)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-surface-900 text-2xl font-extrabold uppercase tracking-tight">
              {pgName}
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            <a
              href="#amenities"
              className="text-surface-600 hover:text-surface-900 text-sm font-semibold transition-colors duration-[var(--transition-duration)]"
            >
              Amenities
            </a>
            <a
              href="#rooms"
              className="text-surface-600 hover:text-surface-900 text-sm font-semibold transition-colors duration-[var(--transition-duration)]"
            >
              Rooms
            </a>
            <a
              href="#about"
              className="text-surface-600 hover:text-surface-900 text-sm font-semibold transition-colors duration-[var(--transition-duration)]"
            >
              About
            </a>
            <a
              href="#testimonials"
              className="text-surface-600 hover:text-surface-900 text-sm font-semibold transition-colors duration-[var(--transition-duration)]"
            >
              Reviews
            </a>
            <a
              href="#contact"
              className="text-surface-600 hover:text-surface-900 text-sm font-semibold transition-colors duration-[var(--transition-duration)]"
            >
              Contact
            </a>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Login
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] p-2 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="animate-slide-in-left space-y-3 border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-4 md:hidden">
            <a
              href="#amenities"
              className="text-surface-700 block py-2 text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Amenities
            </a>
            <a
              href="#rooms"
              className="text-surface-700 block py-2 text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Rooms
            </a>
            <a
              href="#about"
              className="text-surface-700 block py-2 text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              About
            </a>
            <a
              href="#testimonials"
              className="text-surface-700 block py-2 text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Reviews
            </a>
            <a
              href="#contact"
              className="text-surface-700 block py-2 text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Contact
            </a>
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full">
                Login
              </Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-brand-500 relative overflow-hidden border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)]">
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
          <h1 className="font-display mb-4 text-4xl font-extrabold uppercase leading-tight text-white drop-shadow-[var(--shadow-card)] md:text-6xl">
            {headline}
          </h1>
          <p className="text-brand-100 font-[family:var(--font-body)] mx-auto mb-8 max-w-2xl text-lg md:text-xl">
            {subline}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#contact">
              <Button
                variant="secondary"
                size="lg"
                className="text-brand-600 bg-[color:var(--color-surface-100)] shadow-[var(--shadow-card)]"
              >
                Book a Visit
              </Button>
            </a>
            <a href="#rooms">
              <Button
                variant="outline"
                size="lg"
                className="hover:bg-brand-600 border-white text-white"
              >
                View Rooms & Pricing
              </Button>
            </a>
          </div>
        </div>
        {/* Decorative dots */}
        <div className="absolute right-8 top-8 h-16 w-16 rounded-full border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white/10" />
        <div className="absolute bottom-12 left-12 h-24 w-24 rounded-full border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white/10" />
      </section>

      {/* Amenities Grid */}
      <section id="amenities" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="font-display text-surface-900 mb-3 text-3xl font-extrabold uppercase md:text-4xl">
            Premium Amenities Included
          </h2>
          <p className="text-surface-500 font-body mx-auto max-w-xl">
            Everything you need for a comfortable, stress-free stay at {pgName}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {amenities.map((amenity, i) => (
            <div
              key={i}
              className="hover:translate-[var(--hover-lift)] rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 text-center shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] hover:shadow-[var(--shadow-button)]"
            >
              <div className="bg-brand-100 text-brand-600 mx-auto mb-3 w-fit rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] p-2">
                {amenity.toLowerCase().includes('wifi') ? (
                  <Zap className="h-5 w-5" />
                ) : amenity.toLowerCase().includes('security') ? (
                  <Shield className="h-5 w-5" />
                ) : amenity.toLowerCase().includes('meal') ||
                  amenity.toLowerCase().includes('food') ? (
                  <Users className="h-5 w-5" />
                ) : amenity.toLowerCase().includes('water') ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Award className="h-5 w-5" />
                )}
              </div>
              <h3 className="font-display text-surface-900 text-sm font-bold tracking-tight">
                {amenity}
              </h3>
            </div>
          ))}
        </div>
      </section>

      {/* Room Pricing Section */}
      <section
        id="rooms"
        className="border-y-[length:var(--bw-strong)] border-y-[color:var(--border-color)] bg-[color:var(--color-surface-100)] py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="font-display text-surface-900 mb-3 text-3xl font-extrabold uppercase md:text-4xl">
              Room Sharing & Pricing
            </h2>
            <p className="text-surface-500 font-body mx-auto max-w-xl">
              Affordable, transparent pricing models based on sharing occupancy preferences.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* 2 Sharing */}
            <div className="bg-surface-50 hover:translate-[var(--hover-lift)] relative flex flex-col justify-between rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]">
              <div>
                <h3 className="font-display text-surface-900 text-xl font-bold uppercase">
                  2 Sharing
                </h3>
                <p className="text-surface-500 font-body mt-1 text-sm">Double sharing occupancy</p>
                <div className="my-6">
                  <span className="text-surface-900 font-display text-4xl font-extrabold">
                    ₹{roomPricing.sharing2}
                  </span>
                  <span className="text-surface-500 text-sm font-semibold"> / month</span>
                </div>
                <ul className="font-body text-surface-700 mb-6 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> Attached Bathroom
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> High-speed WiFi
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> AC / Ventilation Comfort
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full bg-[color:var(--color-surface-100)]"
                onClick={() => handleEnquireClick('2')}
              >
                Enquire Now
              </Button>
            </div>

            {/* 3 Sharing - Popular */}
            <div className="hover:translate-[var(--hover-lift)] ring-3 relative flex flex-col justify-between rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--color-brand-500)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)] ring-[color:var(--color-brand-500)] ring-offset-2 transition-all duration-[var(--transition-duration)]">
              <div className="bg-brand-500 font-display absolute -top-3.5 right-6 rounded-full border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                Most Popular
              </div>
              <div>
                <h3 className="font-display text-surface-900 text-xl font-bold uppercase">
                  3 Sharing
                </h3>
                <p className="text-surface-500 font-body mt-1 text-sm">Triple sharing occupancy</p>
                <div className="my-6">
                  <span className="text-surface-900 font-display text-4xl font-extrabold">
                    ₹{roomPricing.sharing3}
                  </span>
                  <span className="text-surface-500 text-sm font-semibold"> / month</span>
                </div>
                <ul className="font-body text-surface-700 mb-6 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> Spacious Living Area
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> Attached Bathroom
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> High-speed WiFi
                  </li>
                </ul>
              </div>
              <Button
                variant="primary"
                className="mt-4 w-full"
                onClick={() => handleEnquireClick('3')}
              >
                Enquire Now
              </Button>
            </div>

            {/* 4 Sharing */}
            <div className="bg-surface-50 hover:translate-[var(--hover-lift)] relative flex flex-col justify-between rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]">
              <div>
                <h3 className="font-display text-surface-900 text-xl font-bold uppercase">
                  4 Sharing
                </h3>
                <p className="text-surface-500 font-body mt-1 text-sm">Quad sharing occupancy</p>
                <div className="my-6">
                  <span className="text-surface-900 font-display text-4xl font-extrabold">
                    ₹{roomPricing.sharing4}
                  </span>
                  <span className="text-surface-500 text-sm font-semibold"> / month</span>
                </div>
                <ul className="font-body text-surface-700 mb-6 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> Budget Friendly
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> High-speed WiFi
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="text-success-600 h-4 w-4" /> Locker Facilities
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full bg-[color:var(--color-surface-100)]"
                onClick={() => handleEnquireClick('4')}
              >
                Enquire Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="font-display text-surface-900 mb-3 text-3xl font-extrabold uppercase md:text-4xl">
            Visual Gallery
          </h2>
          <p className="text-surface-500 font-body mx-auto max-w-xl">
            Take a virtual tour of our rooms, dining area, and facilities.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <div className="hover:translate-[var(--hover-lift)] overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]">
            <div className="h-48 overflow-hidden bg-surface-100">
              <img
                src="/images/gallery-room.jpg"
                alt="Premium Double-Sharing Suite"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="border-t-[length:var(--bw-default)] border-[color:var(--border-color)] p-4">
              <h3 className="font-display text-surface-900 text-lg font-bold">
                Premium Double-Sharing Suite
              </h3>
              <p className="text-surface-500 font-body mt-1 text-sm">
                Fully ventilated rooms with modern study desks and comfortable beds.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="hover:translate-[var(--hover-lift)] overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]">
            <div className="bg-success-500 flex h-48 items-center justify-center text-white">
              <span className="font-display text-2xl font-bold uppercase tracking-wider">
                Mess Hall
              </span>
            </div>
            <div className="border-t-[length:var(--bw-default)] border-[color:var(--border-color)] p-4">
              <h3 className="font-display text-surface-900 text-lg font-bold">
                Feedback-Driven Canteen
              </h3>
              <p className="text-surface-500 font-body mt-1 text-sm">
                Hygienic dining setup serving home-style meals.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="hover:translate-[var(--hover-lift)] overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]">
            <div className="bg-brand-400 flex h-48 items-center justify-center text-white">
              <span className="font-display text-2xl font-bold uppercase tracking-wider">
                Study Lounge
              </span>
            </div>
            <div className="border-t-[length:var(--bw-default)] border-[color:var(--border-color)] p-4">
              <h3 className="font-display text-surface-900 text-lg font-bold">Quiet Study Area</h3>
              <p className="text-surface-500 font-body mt-1 text-sm">
                Dedicated space for high-productivity workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)] bg-[color:var(--color-surface-100)] py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-display text-surface-900 mb-4 text-3xl font-extrabold uppercase md:text-4xl">
                About {pgName}
              </h2>
              <p className="text-surface-600 font-body mb-4 leading-relaxed">
                We provide premium paying guest accommodations designed for working professionals
                and students who value comfort, convenience, and community. Our properties are
                strategically located near major business hubs and educational institutions.
              </p>
              <p className="text-surface-600 font-body mb-6 leading-relaxed">
                Every room is fully furnished with modern amenities including high-speed internet,
                attached bathrooms, and 24/7 power backup. We take pride in our transparent billing
                and responsive management.
              </p>
              <div className="text-surface-500 font-display flex items-center gap-4 text-sm font-semibold">
                <span className="flex items-center gap-1">
                  <MapPin className="text-brand-600 h-4 w-4" /> Prime Location
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="text-brand-600 h-4 w-4" /> 24×7 Support
                </span>
              </div>
            </div>
            <div className="bg-brand-500 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-8 text-center text-white shadow-[var(--shadow-card)]">
              <p className="font-display mb-2 text-6xl font-extrabold">500+</p>
              <p className="text-brand-100 mb-6 text-sm font-semibold uppercase tracking-wider">
                Happy Residents
              </p>
              <div className="font-display grid grid-cols-2 gap-4 text-left">
                <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white/10 p-3">
                  <p className="font-display text-2xl font-bold">99%</p>
                  <p className="text-brand-200 text-xs font-bold uppercase tracking-wider">
                    Occupancy
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white/10 p-3">
                  <p className="font-display text-2xl font-bold">4.8</p>
                  <p className="text-brand-200 text-xs font-bold uppercase tracking-wider">
                    Avg Rating
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white/10 p-3">
                  <p className="font-display text-2xl font-bold">24×7</p>
                  <p className="text-brand-200 text-xs font-bold uppercase tracking-wider">
                    Security
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-white/10 p-3">
                  <p className="font-display text-2xl font-bold">3</p>
                  <p className="text-brand-200 text-xs font-bold uppercase tracking-wider">
                    Meals/Day
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section
        id="testimonials"
        className="bg-surface-50 border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="font-display text-surface-900 mb-3 text-3xl font-extrabold uppercase md:text-4xl">
              What Our Residents Say
            </h2>
            <p className="text-surface-500 font-body mx-auto max-w-xl">
              Read real feedback from working professionals and students currently living in{' '}
              {pgName}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="hover:translate-[var(--hover-lift)] flex flex-col justify-between rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]"
              >
                <div>
                  <div className="text-warning-500 mb-4 flex gap-1">
                    {Array.from({ length: t.rating }).map((_, idx) => (
                      <Star key={idx} className="h-4 w-4" fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-surface-700 font-body mb-4 text-sm italic leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="border-[color:var(--border-color)] flex items-center justify-between border-t-[length:var(--bw-default)] pt-4">
                  <span className="font-display text-surface-900 text-sm font-extrabold uppercase">
                    {t.name}
                  </span>
                  {t.occupation && (
                    <span className="text-surface-400 font-body text-xs font-semibold">
                      {t.occupation}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map and Enquiry Section */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {/* Map Location */}
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-surface-900 mb-3 text-3xl font-extrabold uppercase">
                Our Location
              </h2>
              <p className="text-surface-500 font-body">
                Drop by for a visit! We are centrally located and easy to reach.
              </p>
            </div>

            <div className="bg-surface-200 h-80 overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] shadow-[var(--shadow-card)]">
              {mapsEmbedUrl ? (
                <iframe
                  title="Google Maps Location"
                  src={mapsEmbedUrl}
                  className="h-full w-full border-none"
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <div className="text-surface-500 font-display flex h-full w-full flex-col items-center justify-center p-8 text-center">
                  <MapPin className="text-brand-500 mb-2 h-10 w-10" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    {address.line1}
                  </span>
                  <span className="mt-1 text-xs">
                    {address.city}, {address.state} - {address.pincode}
                  </span>
                </div>
              )}
            </div>

            <div className="font-display flex flex-col gap-3 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Phone className="text-brand-600 h-4 w-4" />
                <span>{phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="text-brand-600 h-4 w-4" />
                <span>{email}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            <div className="mb-6">
              <h2 className="font-display text-surface-900 mb-3 text-3xl font-extrabold uppercase">
                Get in Touch
              </h2>
              <p className="text-surface-500 font-body">
                Interested in booking? Send us an enquiry and we will respond within 24 hours.
              </p>
            </div>

            {formSent ? (
              <div className="bg-success-100 font-display rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-8 text-center shadow-[var(--shadow-card)]">
                <div className="mb-3 flex justify-center">
                  <Check className="text-success-600 h-10 w-10" />
                </div>
                <h3 className="font-display text-success-800 mb-2 text-xl font-bold uppercase">
                  Thank You!
                </h3>
                <p className="text-success-700 font-[family:var(--font-body)]">
                  We have received your enquiry and will get back to you shortly.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleEnquiry}
                className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
              >
                <Input label="Full Name" name="name" placeholder="John Doe" required />
                <Input
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  required
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="message"
                    className="text-surface-800 font-display text-sm font-semibold"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Tell us about your requirements..."
                    className="text-surface-900 placeholder:text-surface-400 focus:ring-brand-500 font-[family:var(--font-body)] w-full resize-none rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
                  />
                </div>
                {formError && <p className="text-danger-600 text-sm font-medium">{formError}</p>}
                <Button type="submit" loading={isSubmitting} size="lg" className="w-full">
                  <Send className="h-4 w-4" />
                  Send Enquiry
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-900 text-surface-200 border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)]">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                {pgName}
              </span>
            </div>
            <div className="font-display flex items-center gap-6 text-sm font-semibold">
              <a
                href="#amenities"
                className="transition-colors duration-[var(--transition-duration)] hover:text-white"
              >
                Amenities
              </a>
              <a
                href="#rooms"
                className="transition-colors duration-[var(--transition-duration)] hover:text-white"
              >
                Rooms
              </a>
              <a
                href="#about"
                className="transition-colors duration-[var(--transition-duration)] hover:text-white"
              >
                About
              </a>
              <a
                href="#testimonials"
                className="transition-colors duration-[var(--transition-duration)] hover:text-white"
              >
                Reviews
              </a>
              <Link
                href="/login"
                className="transition-colors duration-[var(--transition-duration)] hover:text-white"
              >
                Admin Login
              </Link>
            </div>
            <p className="text-surface-400 font-body text-xs">
              &copy; {new Date().getFullYear()} {pgName}. All rights reserved.
            </p>
          </div>
          {social && (
            <div className="text-surface-400 border-surface-800 mt-4 flex justify-center gap-4 border-t pt-4">
              {social.instagram && (
                <a
                  href={social.instagram}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {social.facebook && (
                <a
                  href={social.facebook}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {social.whatsapp && (
                <a
                  href={social.whatsapp}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                >
                  <Phone className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}