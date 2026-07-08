'use client';

import { useState, useEffect, useMemo } from 'react';
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
  ArrowRight,
  ExternalLink,
  Wifi,
  Droplets,
  Sparkles,
  ChefHat,
  BookOpen,
  Lock,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer, fadeScaleIn } from '@/lib/animations';
import type { IAppConfigPublic } from '@pg/types';

const TENANT_APP_URL = process.env.NEXT_PUBLIC_TENANT_APP_URL ?? '';

// ── Animated Hero Background (Geometric Floating Shapes) ──

function HeroBackground() {
  // Static geometry — no runtime random, stable across SSR/hydration
  const shapes = useMemo(
    () => [
      { cx: 82, cy: 18, r: 40, opacity: 0.08, delay: 0 },
      { cx: 12, cy: 72, r: 56, opacity: 0.06, delay: 0.3 },
      { cx: 74, cy: 88, r: 28, opacity: 0.1, delay: 0.6 },
      { cx: 94, cy: 42, r: 18, opacity: 0.07, delay: 0.9 },
      // Rectangles
      { x: 88, y: 12, w: 34, h: 34, rx: 8, opacity: 0.06, delay: 0.15 },
      { x: 8, y: 48, w: 24, h: 24, rx: 6, opacity: 0.09, delay: 0.45 },
      { x: 66, y: 64, w: 20, h: 20, rx: 4, opacity: 0.07, delay: 0.75 },
    ],
    [],
  );

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {shapes.map((s, i) => {
        if ('r' in s) {
          return (
            <motion.circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="white"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: s.opacity, scale: [0.9, 1.1, 0.9] }}
              transition={{
                duration: 6 + i * 1.2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
                delay: s.delay,
              }}
            />
          );
        }
        return (
          <motion.rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.rx}
            fill="white"
            initial={{ opacity: 0, rotate: -10 }}
            animate={{ opacity: s.opacity, rotate: [0, 8, -4, 0] }}
            transition={{
              duration: 8 + i * 1.5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: s.delay,
            }}
          />
        );
      })}
    </svg>
  );
}

// ── Section wrapper with stagger animation ─────────────

function Section({
  id,
  className = '',
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ── Amenity icon resolver ──────────────────────────────

function getAmenityIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes('wifi')) return <Wifi className="h-5 w-5" />;
  if (lower.includes('water') || lower.includes('ro')) return <Droplets className="h-5 w-5" />;
  if (lower.includes('food') || lower.includes('meal') || lower.includes('canteen'))
    return <ChefHat className="h-5 w-5" />;
  if (lower.includes('security') || lower.includes('cctv')) return <Lock className="h-5 w-5" />;
  if (lower.includes('clean') || lower.includes('housekeeping'))
    return <Sparkles className="h-5 w-5" />;
  if (lower.includes('study') || lower.includes('library')) return <BookOpen className="h-5 w-5" />;
  if (lower.includes('power') || lower.includes('electricity')) return <Zap className="h-5 w-5" />;
  if (lower.includes('laundry') || lower.includes('washing'))
    return <Shield className="h-5 w-5" />;
  return <Check className="h-5 w-5" />;
}

// ── Landing Page ───────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [config, setConfig] = useState<IAppConfigPublic | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'}/app-config`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setConfig(res.data);
      })
      .catch(() => {});
  }, []);

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const pgName = config?.pgName || 'Apex PG';
  const headline =
    config?.landingHeroHeadline || 'Premium PG Living, Effortlessly Managed';
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
  const amenities = config?.amenities?.length
    ? config.amenities
    : [
        'High-Speed WiFi',
        'Washing Machine',
        'Fridge',
        'RO Water',
        'Housekeeping',
        '24/7 Security',
      ];
  const roomPricing = config?.roomPricing || {
    sharing2: 8000,
    sharing3: 6500,
    sharing4: 5000,
  };
  const testimonials = config?.testimonials?.length
    ? config.testimonials
    : [
        {
          name: 'Rahul Sharma',
          occupation: 'Software Engineer',
          rating: 5,
          quote:
            'Best PG experience in Bangalore! Super clean rooms, and the food is great.',
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
  const heroBgUrl = config?.heroImageUrl;

  const handleEnquireClick = (sharingType: string) => {
    setMessageText(
      `Hi, I am interested in checking availability for a ${sharingType} sharing room.`,
    );
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
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

  const handleTenantApp = () => {
    if (TENANT_APP_URL) {
      window.open(TENANT_APP_URL, '_noopener');
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--color-surface-50)] text-[color:var(--color-text-primary)] transition-colors duration-[var(--transition-duration)]">
      {/* ── Nav ──────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-[var(--transition-duration-slow)] ${
          scrolled
            ? 'border-b-[color:var(--border-color)] bg-[color:var(--glass-bg-strong)] backdrop-blur-[var(--glass-blur-strong)] shadow-[var(--shadow-sm)]'
            : 'border-b-transparent bg-[color:var(--glass-bg)] backdrop-blur-[var(--glass-blur)]'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-brand-500)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)] group-hover:shadow-[var(--shadow-md)] group-hover:scale-105">
              <span className="font-bold text-white text-xs tracking-tight">A</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">
              {pgName}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {['amenities', 'rooms', 'gallery', 'testimonials', 'contact'].map((link) => (
              <a
                key={link}
                href={`#${link}`}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[color:var(--color-text-secondary)] transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] hover:text-[color:var(--color-text-primary)]"
              >
                {link.charAt(0).toUpperCase() + link.slice(1)}
              </a>
            ))}
            {TENANT_APP_URL && (
              <Button variant="primary" size="sm" onClick={handleTenantApp} className="ml-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Tenants & Guardians
              </Button>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg border border-[color:var(--border-color)] p-2 md:hidden text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-t-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-4 space-y-1 md:hidden">
            {['amenities', 'rooms', 'gallery', 'testimonials', 'contact'].map((link) => (
              <a
                key={link}
                href={`#${link}`}
                className="block rounded-lg px-3 py-2.5 text-[13px] font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-50)] hover:text-[color:var(--color-text-primary)] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.charAt(0).toUpperCase() + link.slice(1)}
              </a>
            ))}
            {TENANT_APP_URL && (
              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    handleTenantApp();
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Tenants & Guardians
                </Button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Hero (Theme-aware + Geometric Animated BG) ── */}
      <section className="relative overflow-hidden bg-[color:var(--color-brand-500)] border-b border-b-[color:var(--color-brand-600)]">
        {/* Animated geometric background */}
        <HeroBackground />

        {/* Optional hero image overlay */}
        {heroBgUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-15"
            style={{ backgroundImage: `url(${heroBgUrl})` }}
          />
        )}

        <div className="relative z-10 mx-auto max-w-3xl px-4 py-20 text-center md:py-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5"
          >
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-success-400)] animate-pulse" />
            <span className="text-xs font-semibold text-white/90">Now Open for Bookings</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl"
          >
            {headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[color:var(--color-brand-100)] md:text-base"
          >
            {subline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a href="#contact">
              <Button variant="secondary" size="lg">
                Book a Visit
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#rooms">
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 hover:border-white/50"
              >
                View Rooms & Pricing
              </Button>
            </a>
            {TENANT_APP_URL && (
              <Button
                variant="outline"
                size="lg"
                className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white hover:border-white/40"
                onClick={handleTenantApp}
              >
                <ExternalLink className="h-4 w-4" />
                App Login
              </Button>
            )}
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 grid grid-cols-3 gap-4 mx-auto max-w-md"
          >
            {[
              { val: '99%', label: 'Occupancy' },
              { val: '4.8', label: 'Avg Rating' },
              { val: '24x7', label: 'Security' },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 py-3 px-2 backdrop-blur-sm"
              >
                <p className="text-xl font-bold text-white tabular-nums">{s.val}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-200)]">
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Amenities ─────────────────────────────── */}
      <Section id="amenities" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <motion.div variants={fadeInUp} className="mb-12 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-500)]">
            Amenities
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything included
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
            Everything you need for a comfortable, stress-free stay at {pgName}.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {amenities.map((amenity, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="group rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 text-center shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-600)] shadow-[var(--shadow-xs)] transition-colors duration-[var(--transition-duration)] group-hover:bg-[color:var(--color-brand-500)] group-hover:text-white group-hover:border-[color:var(--color-brand-500)]">
                {getAmenityIcon(amenity)}
              </div>
              <h3 className="text-[13px] font-semibold tracking-tight">{amenity}</h3>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Room Pricing ──────────────────────────── */}
      <Section
        id="rooms"
        className="border-y border-y-[color:var(--border-color)] bg-[color:var(--color-surface-100)] py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4">
          <motion.div variants={fadeInUp} className="mb-12 text-center">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-500)]">
              Pricing
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Transparent, affordable plans
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
              Flexible sharing options designed around your budget and comfort.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[2, 3, 4].map((share, idx) => {
              const price =
                share === 2
                  ? roomPricing.sharing2
                  : share === 3
                    ? roomPricing.sharing3
                    : roomPricing.sharing4;
              const features =
                share === 2
                  ? ['Attached Bathroom', 'High-speed WiFi', 'AC / Ventilation']
                  : share === 3
                    ? ['Spacious Living Area', 'Attached Bathroom', 'High-speed WiFi']
                    : ['Budget Friendly', 'High-speed WiFi', 'Locker Facilities'];
              const isPopular = share === 3;

              return (
                <motion.div
                  key={share}
                  variants={fadeInUp}
                  className={`relative flex flex-col rounded-xl border bg-[color:var(--color-surface-50)] p-6 shadow-[var(--shadow-md)] transition-all duration-[var(--transition-duration)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 ${
                    isPopular
                      ? 'border-[color:var(--color-brand-500)] ring-1 ring-[color:var(--color-brand-500)]'
                      : 'border-[color:var(--border-color)]'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 right-6 rounded-full border border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-500)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[var(--shadow-sm)]">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <h3 className="text-lg font-bold">{share} Sharing</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                      {share === 2
                        ? 'Double sharing occupancy'
                        : share === 3
                          ? 'Triple sharing occupancy'
                          : 'Quad sharing occupancy'}
                    </p>

                    <div className="my-5">
                      <span className="text-3xl font-bold tabular-nums">₹{price}</span>
                      <span className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                        {' '}
                        / month
                      </span>
                    </div>

                    <ul className="mb-6 space-y-2">
                      {features.map((f, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--color-text-secondary)]"
                        >
                          <Check className="h-4 w-4 flex-shrink-0 text-[color:var(--color-success-500)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    variant={isPopular ? 'primary' : 'outline'}
                    className="mt-auto w-full"
                    onClick={() => handleEnquireClick(String(share))}
                  >
                    Enquire Now
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── Gallery ──────────────────────────────── */}
      <Section id="gallery" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <motion.div variants={fadeInUp} className="mb-12 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-500)]">
            Gallery
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            See it for yourself
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
            Take a virtual tour of our rooms, dining area, and facilities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              img: '/images/gallery-suite.jpg',
              title: 'Premium Double-Sharing Suite',
              desc: 'Fully ventilated rooms with modern study desks and comfortable beds.',
            },
            {
              img: '/images/gallery-canteen.jpg',
              title: 'Feedback-Driven Canteen',
              desc: 'Hygienic dining setup serving home-style meals with daily feedback scoring.',
            },
            {
              img: null,
              title: 'Quiet Study Area',
              desc: 'Dedicated space for high-productivity workflow with 24/7 power backup.',
              bg: 'bg-[color:var(--color-brand-400)]',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="group overflow-hidden rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-md)] transition-all duration-[var(--transition-duration)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5"
            >
              <div className="h-48 overflow-hidden bg-[color:var(--color-surface-200)]">
                {item.img ? (
                  <img
                    src={item.img}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-[var(--duration-glacial)] group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center text-white ${item.bg}`}
                  >
                    <span className="text-lg font-bold uppercase tracking-widest">
                      {item.title.split(' ').pop()}
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-t-[color:var(--border-color)] p-4">
                <h3 className="text-[15px] font-bold text-[color:var(--color-text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── About ──────────────────────────────────── */}
      <Section
        id="about"
        className="border-y border-y-[color:var(--border-color)] bg-[color:var(--color-surface-100)] py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <motion.div variants={fadeInUp}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-500)]">
                About Us
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Why {pgName}?
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
                We provide premium paying guest accommodations designed for working professionals
                and students who value comfort, convenience, and community. Our properties are
                strategically located near major business hubs and educational institutions.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
                Every room is fully furnished with modern amenities including high-speed internet,
                attached bathrooms, and 24/7 power backup. We take pride in our transparent billing
                and responsive management.
              </p>
              <div className="mt-6 flex items-center gap-6 text-[13px] font-semibold text-[color:var(--color-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                  Prime Location
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                  24×7 Support
                </span>
              </div>
            </motion.div>

            <motion.div
              variants={fadeScaleIn}
              className="rounded-xl border border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-500)] p-8 text-center text-white shadow-[var(--shadow-lg)]"
            >
              <p className="text-5xl font-bold">500+</p>
              <p className="mt-1 text-[13px] font-medium text-[color:var(--color-brand-100)]">
                Happy Residents
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  { val: '99%', label: 'Occupancy' },
                  { val: '4.8', label: 'Avg Rating' },
                  { val: '24×7', label: 'Security' },
                  { val: '3', label: 'Meals/Day' },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/15 bg-white/10 p-3"
                  >
                    <p className="text-2xl font-bold">{s.val}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-200)]">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── Testimonials ──────────────────────────── */}
      <Section id="testimonials" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <motion.div variants={fadeInUp} className="mb-12 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-500)]">
            Testimonials
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Loved by residents
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
            Real feedback from working professionals and students at {pgName}.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="flex flex-col rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-md)] transition-all duration-[var(--transition-duration)] hover:shadow-[var(--shadow-lg)]"
            >
              <div className="mb-3 flex gap-0.5 text-[color:var(--color-warning-500)]">
                {Array.from({ length: t.rating }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4" fill="currentColor" />
                ))}
              </div>
              <p className="flex-1 text-[15px] italic leading-relaxed text-[color:var(--color-text-secondary)]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-t-[color:var(--color-surface-200)] pt-4">
                <span className="text-[13px] font-bold text-[color:var(--color-text-primary)]">
                  {t.name}
                </span>
                {t.occupation && (
                  <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                    {t.occupation}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Contact ───────────────────────────────── */}
      <Section
        id="contact"
        className="border-t border-t-[color:var(--border-color)] bg-[color:var(--color-surface-100)] py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <motion.div variants={fadeInUp} className="space-y-6">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand-500)]">
                  Contact
                </p>
                <h2 className="text-3xl font-bold tracking-tight">Get in touch</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--color-text-secondary)]">
                  Drop by for a visit! We are centrally located and easy to reach.
                </p>
              </div>

              <div className="h-72 overflow-hidden rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-200)] shadow-[var(--shadow-md)]">
                {mapsEmbedUrl ? (
                  <iframe
                    title="Google Maps Location"
                    src={mapsEmbedUrl}
                    className="h-full w-full border-none"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
                    <MapPin className="mb-2 h-8 w-8 text-[color:var(--color-brand-500)]" />
                    <span className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {address.line1}
                    </span>
                    <span className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                      {address.city}, {address.state} - {address.pincode}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 text-[13px] font-medium text-[color:var(--color-text-secondary)]">
                <span className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                  {phone}
                </span>
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                  {email}
                </span>
              </div>
            </motion.div>

            <motion.div variants={fadeInUp}>
              {formSent ? (
                <div className="rounded-xl border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] p-8 text-center shadow-[var(--shadow-md)]">
                  <Check className="mx-auto h-10 w-10 text-[color:var(--color-success-500)]" />
                  <h3 className="mt-3 text-lg font-bold text-[color:var(--color-success-700)]">
                    Thank You!
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-success-600)]">
                    We have received your enquiry and will get back to you shortly.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleEnquiry}
                  className="space-y-4 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-6 shadow-[var(--shadow-md)]"
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
                      className="text-[13px] font-semibold text-[color:var(--color-text-primary)]"
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
                      className="w-full resize-none rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3.5 py-2 text-sm font-medium text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:border-[color:var(--color-brand-500)]"
                    />
                  </div>
                  {formError && (
                    <p className="text-[12px] font-medium text-[color:var(--color-danger-600)]">
                      {formError}
                    </p>
                  )}
                  <Button type="submit" loading={isSubmitting} size="lg" className="w-full">
                    <Send className="h-4 w-4" />
                    Send Enquiry
                  </Button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── Footer ────────────────────────────────── */}
      <footer className="border-t border-t-[color:var(--border-color)] bg-[color:var(--color-surface-900)] text-[color:var(--color-surface-400)]">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <span className="text-lg font-bold text-white tracking-tight">{pgName}</span>
            <nav className="flex items-center gap-6 text-[13px] font-medium">
              {['amenities', 'rooms', 'gallery', 'testimonials'].map((link) => (
                <a
                  key={link}
                  href={`#${link}`}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                >
                  {link.charAt(0).toUpperCase() + link.slice(1)}
                </a>
              ))}
            </nav>
            <p className="text-[12px]">
              &copy; {new Date().getFullYear()} {pgName}. All rights reserved.
            </p>
          </div>
          {social && (
            <div className="mt-4 flex justify-center gap-4 border-t border-t-[color:var(--color-surface-700)] pt-4">
              {social.instagram && (
                <a
                  href={social.instagram}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {social.facebook && (
                <a
                  href={social.facebook}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {social.whatsapp && (
                <a
                  href={social.whatsapp}
                  className="transition-colors duration-[var(--transition-duration)] hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
