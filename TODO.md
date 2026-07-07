# Phase-by-Phase Implementation Tasks

## Phase 1: Fix CRUD Operations (Edit Pages)
- [x] Audit existing edit pages and identify broken schemas
- [ ] Fix ALL edit pages with correct Zod schemas, status options, and API integration
- [ ] Add DELETE functionality to all list pages with confirmation modal
- [ ] Ensure PUT/DELETE API routes exist on backend

## Phase 2: Fix Dark Mode & Theme Application
- [ ] Fix ThemeProvider to properly read/write mode from AppConfig
- [ ] Ensure dark mode CSS cascade works (data-theme + data-mode)
- [ ] Complete AppearanceTab component
- [ ] Fix theme persistence flow (Settings → API → ThemeProvider)

## Phase 3: Fix API Integration Gaps
- [ ] Ensure all new/* routes properly POST and redirect
- [ ] Fix any API response shape mismatches in edit pages
- [ ] Add missing backend PUT/DELETE routes if needed

## Phase 4: Complete Theming Everywhere
- [ ] Ensure all hardcoded CSS values use var() tokens
- [ ] Verify all 4 themes render correctly
- [ ] Add remaining theme-aware elements

## Phase 5: Feature Completion
- [ ] Add missing sub-pages/services
- [ ] Verify all functional flows
- [ ] Build verification
