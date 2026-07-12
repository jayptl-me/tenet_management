# Product

## Register

product

## Users

**Primary:** PG (paying guest) administrators. They use the **Next.js admin web app** (`apps/web`) for operations across tenants, rooms, finance, facilities, and settings. Fast, clear, error-resistant admin workflows are the core surface.

**Secondary:** Tenants and guardians. They use the **Flutter resident portal** (`mobile/`), shipped as **Flutter Web and iOS** (and Android) -- one codebase. Tenant flows include invoices, payments/UTR, complaints, visitors, laundry, meals, notices. Guardians use ward overview and attendance. Visitor desk is tenant-owned inside Flutter, not a separate admin web module.

**Not in scope for Next.js:** Tenant, guardian, or visitor App Router portals. Those live only under `mobile/`.

## Product Purpose

A complete PG management system that replaces spreadsheets and paper records. It tracks every operational domain — tenants, rooms, finances, services, communication — in one place. Success means an administrator can complete any task (onboard a tenant, record a payment, resolve a complaint) in under 30 seconds with zero confusion.

## Brand Personality

**Calm, confident, professional.** The tool should feel like a well-organized colleague, not a bureaucratic system. No decoration. No clutter. Every element earns its place. Speed and clarity above all.

## Anti-references

- **Salesforce / Oracle enterprise dashboards**: too heavy, too many nested menus, information overload
- **Notion / whimsical tools**: too playful, too much personality for an operational workflow tool
- **Legacy government/admin portals**: dense tables with no hierarchy, harsh borders, dated type
- **Over-branded SaaS (early Stripe gradient era)**: decorative color, gradient headers, branded illustrations in tool UI

## Design Principles

1. **Disappear into the task** — the interface should be invisible when the user is in flow. No decorative motion, no branded flourishes in operational screens.
2. **One right way** — every action (save, delete, filter, search) should have one obvious, consistent affordance across all 15+ modules.
3. **Calm density** — show enough information to be useful, not so much that it overwhelms. Progressive disclosure over flattening.
4. **Error-resistant** — prevent mistakes through clear labels, confirmation on destructive actions, and inline validation. Never punish the user for the tool's ambiguity.
5. **Fast, then fast** — page loads, form submissions, and navigation transitions should feel instant. Optimistic updates where safe. Skeleton states, not spinners.

## Accessibility & Inclusion

- WCAG 2.1 AA compliant
- Full keyboard navigation for all CRUD operations
- Screen-reader-friendly form labels, error messages, and data tables
- Reduced motion: all transitions collapse to instant or crossfade when `prefers-reduced-motion: reduce` is active
- Color is never the sole indicator of state (icons + text labels accompany status badges)
- Touch targets minimum 44×44px on interactive elements
