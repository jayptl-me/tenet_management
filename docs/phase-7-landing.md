# Phase 7: Landing Page Frontend

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** Public-facing marketing website, fully brandable via AppConfig API, SEO optimized with build-time sitemap/robots.txt, JSON-LD structured data, all sections animated.
**Estimated:** 3-4 days
**Depends On:** Phase 3 (AppConfig API route must be live), Phase 6 (admin settings page to configure content)
**Package Manager:** bun

---

## Architecture Decisions

| Decision   | Choice                                                                   | Rationale                                  |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Rendering  | Static export (`output: 'export'`) with client-side AppConfig fetch      | No SSR server needed on Render free tier   |
| SEO        | Build-time `generate-seo-files.ts` script, Next.js Metadata API, JSON-LD | Search engines can crawl without JS        |
| Forms      | React Hook Form + Zod, POST to public `/enquiries` endpoint              | Consistent with admin forms                |
| Images     | Cloudinary URLs with Next.js `<Image />` (unoptimized for export)        | CDN-delivered, responsive                  |
| Animations | Motion `whileInView` for scroll-triggered animations                     | Performant, only animates visible elements |

---

## Step 7.1: SEO Build Script

### File: `scripts/generate-seo-files.ts`

```typescript
// Generates sitemap.xml and robots.txt at build time
// Run: bun run scripts/generate-seo-files.ts

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-pg.com';

const publicRoutes = ['/', '/#amenities', '/#rooms', '/#location', '/#contact'];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes.map((route) => `  <url><loc>${BASE_URL}${route}</loc><changefreq>monthly</changefreq><priority>${route === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;

await Bun.write('apps/web/public/sitemap.xml', sitemap);

const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /login
Disallow: /api/

Sitemap: ${BASE_URL}/sitemap.xml
`;

await Bun.write('apps/web/public/robots.txt', robots);

console.log('✅ SEO files generated');
```

---

## Step 7.2: Landing Page Layout

### File: `apps/web/src/app/(landing)/layout.tsx`

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PG Management — Premium Paying Guest Accommodation',
  description: 'Safe, comfortable, and affordable PG accommodation with modern amenities.',
  openGraph: {
    title: 'PG Management — Premium Paying Guest Accommodation',
    description: 'Safe, comfortable, and affordable PG accommodation with modern amenities.',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PG Management',
    description: 'Premium paying guest accommodation',
  },
};
```

### JSON-LD Structured Data

Injected in page `head`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      name: config?.pgName,
      description: config?.tagline,
      image: config?.heroImageUrl,
      address: {
        '@type': 'PostalAddress',
        streetAddress: config?.address.line1,
        addressLocality: config?.address.city,
        addressRegion: config?.address.state,
        postalCode: config?.address.pincode,
        addressCountry: 'IN',
      },
      telephone: config?.phone,
      email: config?.email,
      priceRange: `₹${config?.roomPricing?.twoSharing} - ₹${config?.roomPricing?.fourSharing}`,
    }),
  }}
/>
```

---

## Step 7.3: Section Components

### Landing Page Structure

```
<LandingPage>
  <Navbar />               // Fixed, transparent→solid on scroll
  <HeroSection />          // Full viewport, parallax background, headline + CTAs
  <AmenitiesSection />     // Grid cards, scroll animation
  <RoomPricingSection />   // 3 pricing cards, "Most Popular" badge
  <PhotoGallery />         // Masonry/horizontal scroll, lightbox
  <TestimonialsSection />  // Quote cards with ratings
  <LocationSection />      // Google Maps embed + address
  <EnquiryForm />          // Contact form, POST /enquiries
  <Footer />               // 3-column, branding, links, contact
</LandingPage>
```

### Key Components

**Navbar:**

- Logo (image or text from AppConfig)
- Smooth scroll links: Amenities, Rooms, Location, Contact
- CTA: "Book a Visit" button (scrolls to enquiry form)
- Mobile: hamburger with slide-down panel
- Scroll effect: transparent bg → solid dark bg after 100px scroll (Motion `useScroll`)

**Hero Section:**

- Full viewport height (`min-h-svh`)
- Background: heroImageUrl with dark gradient overlay
- Parallax effect using Motion `useScroll` + `useTransform` (image moves at 0.5x scroll speed)
- Content: headline (h1, 5xl-6xl, Syne font, bold), subline (p, lg, DM Sans), two CTAs (primary amber + outline white), stat chips row
- Entrance animation: `fadeInUp` staggered sequence

**Room Pricing Cards:**

- 3 cards: 2-Sharing, 3-Sharing, 4-Sharing
- Price per bed (INR formatted, large)
- Features: WiFi, Laundry, Bathroom (icon + text per card)
- "3-Sharing" card highlighted with "Most Popular" badge + amber border
- "Enquire Now" button pre-fills preferred sharing in enquiry form
- Scroll-triggered `fadeInUp` animation

**Enquiry Form:**

- React Hook Form with Zod: name (required), phone (required, +91 format), email (optional), preferredSharing (Select 2/3/4), message (optional)
- Submit: `POST /enquiries` (public, rate-limited)
- Success: toast + reset form
- Error: inline + toast
- Loading: button spinner
- Card styling: elevated, amber accent border

---

## Step 7.4: AppConfig Hook

### File: `apps/web/src/hooks/useAppConfig.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { IAppConfigPublic } from '@pg/types/appConfig';

const DEFAULT_CONFIG: Partial<IAppConfigPublic> = {
  pgName: 'PG Management',
  tagline: 'Your home, your space.',
  amenities: ['High-Speed WiFi', 'Washing Machine', 'Fridge', '24/7 Water', 'Power Backup'],
  roomPricing: { twoSharing: 8000, threeSharing: 6000, fourSharing: 5000 },
  primaryColor: '#F59E0B',
  landingHeroHeadline: 'Comfortable Living, Just Like Home',
  landingHeroSubline: 'Premium PG accommodation with modern amenities in a safe environment',
  testimonials: [],
};

export function useAppConfigPublic() {
  return useQuery({
    queryKey: ['appConfig', 'public'],
    queryFn: () => apiGet<IAppConfigPublic>('/app-config'),
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_CONFIG as IAppConfigPublic,
  });
}
```

`placeholderData` ensures the page renders immediately with defaults while the API call resolves — no flash of empty content.

---

## Verification Checklist

- [ ] Landing page loads at `/` with all sections
- [ ] Navbar scroll effect: transparent → solid
- [ ] Smooth scroll to sections on nav link click
- [ ] Hero parallax effect works
- [ ] Amenities grid: cards animate in on scroll
- [ ] Room pricing: correct amounts from AppConfig
- [ ] "Most Popular" badge on 3-sharing card
- [ ] Photo gallery lightbox opens on click
- [ ] Testimonials section shows configured testimonials
- [ ] Google Maps iframe loads
- [ ] Enquiry form: submits successfully → POST /enquiries
- [ ] Enquiry form: validation errors show inline
- [ ] Enquiry form: rate limited (3/hr) → 429 toast
- [ ] Mobile responsive: all sections stack correctly
- [ ] SEO: `sitemap.xml` accessible at `/sitemap.xml`
- [ ] SEO: `robots.txt` accessible at `/robots.txt`
- [ ] SEO: JSON-LD script present in page source
- [ ] SEO: Open Graph meta tags present
- [ ] `bun run build` succeeds
- [ ] `bun run typecheck` passes

---

## Edge Cases Summary

| Scenario                   | Handling                                     |
| -------------------------- | -------------------------------------------- |
| AppConfig API down         | Default config shown, page still renders     |
| No hero image configured   | Gradient placeholder background              |
| No testimonials configured | Section hidden entirely                      |
| No Google Maps URL         | Section shows address text only              |
| Enquiry form spam          | Rate limited 3/hr/IP, returns 429            |
| Mobile navbar overflow     | Hamburger menu with slide-down panel         |
| Slow Cloudinary images     | Next.js Image lazy loading, blur placeholder |
