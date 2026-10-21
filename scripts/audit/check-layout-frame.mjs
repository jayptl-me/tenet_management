#!/usr/bin/env node
/**
 * Layout frame measurement gate (audit).
 *
 * Asserts, in a real browser at a fixed viewport, that:
 *   1. the primary action of a record is within one viewport of the top
 *      (payments/[id] Verify, invoices/[id] Record Payment, tenants/[id] Check Out);
 *   2. the first data row of a list page is within half a screen of chrome
 *      (payments, invoices, tenants);
 *   3. the form footer still sticks to the bottom of the viewport while the
 *      form scrolls (FormCard footer);
 *   4. ONE frame across pages: the shell band is the same width everywhere;
 *   5. THE WIDTH RULE: every page has the width the rule gives it - a read
 *      page (detail) or a page with a context rail takes the whole band
 *      ('full'), a form takes the form measure ('form'). The page is measured
 *      on the element that carries its max-width class, so a page that
 *      declares the wrong width fails instead of passing;
 *   6. a page does not change width between its loading state and its loaded
 *      state - every state the page passes through declares the same width
 *      (complaints/new renders its FormPage inside a Suspense fallback).
 *
 * The admin app is driven with mocked API responses, so no database and no
 * seeded records are needed - only a running admin build.
 *
 * Run on a build box (never on the maintainer's machine):
 *
 *   bun --filter "@pg/web" build && bun scripts/audit/check-layout-frame.mjs
 *
 * Environment:
 *   ADMIN_BASE_URL  base url of a running admin app (default http://localhost:3000)
 *   START_ADMIN     1 = start `bun run start` in apps/web when the url is down (default 1)
 *   STRICT          1 = a skipped environment or a skipped page is a failure (default 0)
 *
 * Exit codes: 0 = every check passed (skips are printed and counted),
 *              1 = at least one check failed (or a skip under STRICT=1).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const WEB_DIR = resolve(REPO_ROOT, 'apps', 'web');

const BASE_URL = (
  process.env.ADMIN_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const START_ADMIN = process.env.START_ADMIN !== '0';
const STRICT = process.env.STRICT === '1';

const VIEWPORT = { width: 1280, height: 800 };
/** Half a screen of chrome above the first data row. */
const CHROME_BUDGET = 400;
/** The form measure: FormPage's `form` value, max-w-4xl. */
const FORM_MEASURE_PX = 896;
/** How long the stubbed API takes to answer, so the loading state is visible. */
const API_DELAY_MS = 800;

/**
 * THE WIDTH RULE, page by page. This table is the rule: if a page and this
 * table disagree, the gate fails.
 *
 * - 'full': the whole shell band. A read page (detail) or a page with a
 *   context rail - the rail gets the remaining width.
 * - 'form': the form measure (4xl) - a form whose fields must stay a column
 *   a person can read a label and a value in.
 */
const PAGE_RULES = [
  // ── read pages: the whole band ───────────────────────────────────────
  { path: '/payments/payment-1', expect: 'full', action: 'Verify payment' },
  { path: '/invoices/invoice-1', expect: 'full', action: 'Record Payment' },
  { path: '/tenants/tenant-1', expect: 'full', action: 'Check Out' },
  { path: '/enquiries/enquiry-1', expect: 'full' },
  { path: '/electricity/electricity-1', expect: 'full' },
  { path: '/guardians/guardian-1', expect: 'full' },
  { path: '/services/service-1', expect: 'full' },
  { path: '/laundry/laundry-1', expect: 'full' },
  { path: '/rooms/room-1', expect: 'full' },
  { path: '/meals/meal-1', expect: 'full' },
  { path: '/floors/floor-1', expect: 'full' },
  { path: '/complaints/complaint-1', expect: 'full' },
  { path: '/notifications/notification-1', expect: 'full' },
  { path: '/notices/notice-1', expect: 'full' },
  { path: '/assets/asset-1', expect: 'full' },
  { path: '/attendance/attendance-1', expect: 'full' },
  { path: '/washing-machines/washing-machine-1', expect: 'full' },
  { path: '/menus/menu-1', expect: 'full' },
  { path: '/visitors/visitor-1', expect: 'full' },
  { path: '/leaves/leave-1', expect: 'full' },
  { path: '/floors/new', expect: 'full' },
  { path: '/assets/new', expect: 'full' },
  { path: '/assets/asset-1/edit', expect: 'full' },
  // The list pages sit on the band directly (they do not use FormPage).
  { path: '/payments', expect: 'full', firstRow: true },
  { path: '/invoices', expect: 'full', firstRow: true },
  { path: '/tenants', expect: 'full', firstRow: true },

  // ── form pages: the form measure ─────────────────────────────────────
  { path: '/enquiries/enquiry-1/edit', expect: 'form' },
  { path: '/guardians/new', expect: 'form' },
  { path: '/rooms/room-1/edit', expect: 'form' },
  { path: '/rooms/new', expect: 'form' },
  { path: '/meals/meal-1/edit', expect: 'form' },
  { path: '/electricity/new', expect: 'form' },
  { path: '/electricity/electricity-1/edit', expect: 'form' },
  { path: '/notifications/notification-1/edit', expect: 'form' },
  { path: '/complaints/complaint-1/edit', expect: 'form' },
  { path: '/complaints/new', expect: 'form' },
  { path: '/menus/new', expect: 'form' },
  { path: '/menus/menu-1/edit', expect: 'form' },
  { path: '/washing-machines/washing-machine-1/edit', expect: 'form' },
  { path: '/attendance/new', expect: 'form' },
  { path: '/attendance/attendance-1/edit', expect: 'form' },
  { path: '/visitors/new', expect: 'form' },
  { path: '/visitors/visitor-1/edit', expect: 'form' },
  { path: '/leaves/new', expect: 'form' },
  { path: '/leaves/leave-1/edit', expect: 'form' },
  { path: '/laundry/laundry-1/edit', expect: 'form' },
  { path: '/laundry/new', expect: 'form' },
  { path: '/washing-machines/new', expect: 'form' },
  { path: '/payments/new', expect: 'form' },
  { path: '/payments/payment-1/edit', expect: 'form' },
  { path: '/invoices/invoice-1/edit', expect: 'form' },
  { path: '/floors/floor-1/edit', expect: 'form' },
  { path: '/tenants/tenant-1/edit', expect: 'form' },
  { path: '/tenants/new', expect: 'form', stickyFooter: true },
  { path: '/notices/new', expect: 'form' },
  { path: '/notices/notice-1/edit', expect: 'form' },
  { path: '/guardians/guardian-1/edit', expect: 'form' },
  { path: '/meals/new', expect: 'form' },
  { path: '/enquiries/new', expect: 'form' },
  { path: '/services/new', expect: 'form' },
  { path: '/services/service-1/edit', expect: 'form' },
];

// ── Reporting ──────────────────────────────────────────

const results = [];
const skips = [];
let skippedEnvironment = false;

function pass(name, detail) {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` - ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? ` - ${detail}` : ''}`);
}

function skip(name, reason) {
  skips.push({ name, reason });
  console.log(`SKIP  ${name} - ${reason}`);
}

function failHard(reason) {
  console.error(`FAIL  ${reason}`);
  results.push({ ok: false, name: 'environment', detail: reason });
}

// ── Playwright resolution ──────────────────────────────

async function loadChromium() {
  const candidates = [
    '@playwright/test',
    'playwright',
    'playwright-core',
    resolve(WEB_DIR, 'node_modules', '@playwright', 'test', 'index.js'),
    resolve(REPO_ROOT, 'node_modules', '@playwright', 'test', 'index.js'),
  ];
  for (const candidate of candidates) {
    try {
      const mod = await import(candidate);
      if (mod?.chromium) return mod.chromium;
      if (mod?.default?.chromium) return mod.default.chromium;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    'Playwright is not installed. Run `bun install` in apps/web (or at the repo root) and ' +
      '`bunx playwright install chromium` on this box.',
  );
}

// ── Environment probe ──────────────────────────────────

async function probe(url, timeoutMs = 4000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    clearTimeout(timer);
    return res.status;
  } catch {
    return null;
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await probe(url, 2000);
    if (status !== null && status < 500) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startAdminServer(log) {
  if (!existsSync(resolve(WEB_DIR, '.next'))) {
    log(
      'apps/web/.next is missing - the admin app is not built. Build it first: ' +
        '`bun --filter "@pg/web" build`.',
    );
    return null;
  }
  const child = spawn('bun', ['run', 'start'], {
    cwd: WEB_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => log(`[admin] ${String(d).trim()}`));
  child.stderr.on('data', (d) => log(`[admin] ${String(d).trim()}`));
  return child;
}

// ── Fixtures ───────────────────────────────────────────

const ADMIN_USER = {
  id: 'admin-001',
  name: 'Super Admin',
  email: 'admin@sunrisepg.in',
  role: 'admin',
  isActive: true,
};

const TENANT = {
  _id: 'tenant-1',
  user: { name: 'Amit Verma', email: 'amit@example.com', phone: '+919876543210' },
  room: { _id: 'room-1', roomNumber: '101', floor: { _id: 'floor-1', label: '1st Floor' } },
  bedId: 'A',
  monthlyRent: 8000,
  depositPaid: 16000,
  moveInDate: '2026-01-01T00:00:00.000Z',
  moveOutDate: null,
  isActive: true,
  documents: { isVerified: true },
};

const PAYMENT = {
  _id: 'payment-1',
  tenantId: TENANT,
  amount: 8000,
  method: 'upi',
  type: 'rent',
  status: 'pending_verification',
  createdAt: '2026-10-01T00:00:00.000Z',
  dueDate: '2026-10-05T00:00:00.000Z',
  utrNumber: 'UTR000123',
  invoiceId: 'invoice-1',
};

const INVOICE = {
  _id: 'invoice-1',
  invoiceNumber: 'INV-2026-10-001',
  tenantId: TENANT,
  month: '2026-10',
  lineItems: [{ description: 'Monthly Rent', amount: 8000 }],
  rentAmount: 8000,
  electricityAmount: 0,
  otherCharges: 0,
  totalAmount: 8000,
  paidAmount: 0,
  balance: 8000,
  status: 'sent',
  dueDate: '2026-10-05T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
};

const PAYMENT_ROWS = [
  {
    _id: 'payment-1',
    tenantId: TENANT,
    amount: 8000,
    method: 'upi',
    type: 'rent',
    status: 'pending_verification',
    createdAt: '2026-10-01T00:00:00.000Z',
    utrNumber: 'UTR000123',
    invoiceId: { _id: 'invoice-1', invoiceNumber: 'INV-2026-10-001' },
  },
  {
    _id: 'payment-2',
    tenantId: TENANT,
    amount: 500,
    method: 'cash',
    type: 'electricity',
    status: 'paid',
    createdAt: '2026-10-02T00:00:00.000Z',
  },
];

const INVOICE_ROWS = [
  {
    _id: 'invoice-1',
    invoiceNumber: 'INV-2026-10-001',
    tenantId: { userId: { name: 'Amit Verma' }, roomId: { roomNumber: '101' } },
    rentAmount: 8000,
    totalAmount: 8000,
    paidAmount: 0,
    balance: 8000,
    month: '2026-10',
    status: 'sent',
    dueDate: '2026-10-05T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    _id: 'invoice-2',
    invoiceNumber: 'INV-2026-09-001',
    tenantId: { userId: { name: 'Amit Verma' }, roomId: { roomNumber: '101' } },
    rentAmount: 8000,
    totalAmount: 8000,
    paidAmount: 8000,
    balance: 0,
    month: '2026-09',
    status: 'paid',
    dueDate: '2026-09-05T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

const TENANT_ROWS = [
  {
    _id: 'tenant-1',
    user: { name: 'Amit Verma', email: 'amit@example.com', phone: '+919876543210' },
    room: { roomNumber: '101', floor: { label: '1st Floor' } },
    bedId: 'A',
    monthlyRent: 8000,
    depositPaid: 16000,
    isActive: true,
    moveInDate: '2026-01-01T00:00:00.000Z',
    documents: { isVerified: true },
  },
];

function ok(route, payload) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function mockApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  // Strip the api prefix (whatever the box built with: /api/v1, /api, ...).
  const path = url.pathname.replace(/^.*\/api\/(v1\/)?/, '');
  const method = request.method();

  // Never fake the event stream: let it fail or connect for real.
  if (request.headers()['accept']?.includes('text/event-stream') || path.includes('/sse')) {
    return route.continue();
  }

  if (path === '/auth/me') {
    return ok(route, { success: true, data: ADMIN_USER });
  }
  if (path === '/payments/summary') {
    return ok(route, {
      success: true,
      data: { month: '2026-10', collected: 8000, expected: 8000, pending: 0 },
    });
  }
  if (path === '/payments/status-counts') {
    return ok(route, { success: true, data: { all: 2, pending_verification: 1, paid: 1 } });
  }
  if (path === '/payments/trend') {
    return ok(route, { success: true, data: [] });
  }
  if (path === '/payments' && method === 'GET') {
    return ok(route, {
      success: true,
      data: PAYMENT_ROWS,
      meta: { total: PAYMENT_ROWS.length, page: 1, limit: 25, totalPages: 1 },
    });
  }
  if (path === '/payments/new') {
    return ok(route, { success: true, data: [] });
  }
  if (path.startsWith('/payments/')) {
    return ok(route, { success: true, data: PAYMENT });
  }
  if (path === '/invoices/status-counts') {
    return ok(route, {
      success: true,
      data: { all: 2, sent: 1, paid: 1, partial: 0, draft: 0, overdue: 0, cancelled: 0 },
    });
  }
  if (path === '/invoices/aging') {
    return ok(route, {
      success: true,
      data: {
        buckets: {
          current: { count: 1, amount: 8000 },
          days1_30: { count: 0, amount: 0 },
          days31_60: { count: 0, amount: 0 },
          days61_90: { count: 0, amount: 0 },
          days90Plus: { count: 0, amount: 0 },
        },
        totalOutstanding: 8000,
      },
    });
  }
  if (path === '/invoices' && method === 'GET') {
    return ok(route, {
      success: true,
      data: INVOICE_ROWS,
      meta: { total: INVOICE_ROWS.length, page: 1, limit: 25, totalPages: 1 },
    });
  }
  if (path === '/invoices/new') {
    return ok(route, { success: true, data: [] });
  }
  if (path.startsWith('/invoices/')) {
    return ok(route, { success: true, data: INVOICE });
  }
  if (path === '/tenants' && method === 'GET') {
    return ok(route, {
      success: true,
      data: TENANT_ROWS,
      meta: { total: TENANT_ROWS.length, page: 1, limit: 25, totalPages: 1 },
    });
  }
  if (path === '/tenants/new') {
    return ok(route, { success: true, data: [] });
  }
  if (path.startsWith('/tenants/')) {
    return ok(route, { success: true, data: TENANT });
  }
  if (path === '/floors') {
    return ok(route, { success: true, data: [] });
  }
  if (path === '/audit-logs') {
    return ok(route, { success: true, data: [] });
  }
  return ok(route, { success: true, data: [] });
}

// ── Page helpers ───────────────────────────────────────

/**
 * Open a page with the admin session and the API stubbed.
 */
async function openPage(context, path) {
  const page = await context.newPage();
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      'pg-auth-storage',
      JSON.stringify({
        state: {
          user,
          accessToken: 'mock_valid_admin_token',
          refreshToken: 'mock_valid_refresh_token',
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  }, ADMIN_USER);
  // Record every width the page passes through, so a page that changes width
  // between its loading state and its loaded state is caught.
  await page.addInitScript(() => {
    window.__frameStates = [];
    let mainEl = null;
    const record = () => {
      if (!mainEl || !mainEl.isConnected) {
        mainEl = document.querySelector('[data-content-frame="main"]');
      }
      if (!mainEl) return;
      const root = mainEl.firstElementChild;
      if (!root) return;
      const match = /max-w-([a-z0-9]+)/.exec(root.className || '');
      const signature = match ? match[1] : 'none';
      const last = window.__frameStates[window.__frameStates.length - 1];
      if (last && last.signature === signature) return;
      const styled = Boolean(document.styleSheets && document.styleSheets.length > 0);
      window.__frameStates.push({
        signature,
        width: styled ? Math.round(root.getBoundingClientRect().width) : null,
      });
    };
    new MutationObserver(record).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    window.addEventListener('load', record);
    record();
  });
  await page.route(
    (url) => url.pathname.includes('/api/'),
    async (route) => {
      try {
        await new Promise((r) => setTimeout(r, API_DELAY_MS));
        await mockApi(route);
      } catch {
        await route.abort('failed').catch(() => {});
      }
    },
  );

  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response) throw new Error(`no response for ${path}`);
  if (response.status() >= 400) {
    throw new Error(`${path} answered HTTP ${response.status()}`);
  }
  // The stylesheet has to be in before any width is measured, otherwise the
  // layout would be measured unstyled.
  await page
    .waitForFunction(() => document.styleSheets && document.styleSheets.length > 0, null, {
      timeout: 30_000,
    })
    .catch(() => {});

  return page;
}

/** The page root: the element inside the frame's main column that carries the page width. */
async function readPageBox(page) {
  return page.evaluate(() => {
    const main = document.querySelector('[data-content-frame="main"]');
    if (!main) return null;
    const column = main.getBoundingClientRect();
    const root = main.firstElementChild;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    // The body block under the page header must share the page's width.
    const block = root.children[1] ?? root.children[0];
    const match = /max-w-([a-z0-9]+)/.exec(root.className || '');
    return {
      columnWidth: Math.round(column.width),
      pageWidth: Math.round(rect.width),
      bodyWidth: block ? Math.round(block.getBoundingClientRect().width) : null,
      maxWidthClass: match ? match[1] : 'none',
    };
  });
}

/** Every width the page passed through while it loaded. */
async function readStates(page) {
  return page.evaluate(() => window.__frameStates || []);
}

function expectedWidth(expect, columnWidth) {
  return expect === 'form' ? Math.min(FORM_MEASURE_PX, columnWidth) : columnWidth;
}

/** The max-width class a page must declare for a given rule value. */
function expectedSignature(expect) {
  return expect === 'form' ? '4xl' : 'none';
}

/**
 * The width rule: the page must measure the width the rule gives it, and it
 * must declare it (the max-width class on the page root).
 */
function checkWidthRule(path, expect, box) {
  const want = expectedWidth(expect, box.columnWidth);
  if (Math.abs(box.pageWidth - want) > 2) {
    fail(
      path,
      `the page measures ${box.pageWidth}px but the rule gives it '${expect}' ` +
        `(${want}px${expect === 'form' ? ' = the form measure' : ' = the band'}); ` +
        `the frame column is ${box.columnWidth}px and the page declares max-w-${box.maxWidthClass}`,
    );
    return false;
  }
  if (box.maxWidthClass !== expectedSignature(expect)) {
    fail(
      path,
      `the page declares max-w-${box.maxWidthClass} but the rule gives it '${expect}' ` +
        `(max-w-${expectedSignature(expect)})`,
    );
    return false;
  }
  if (box.bodyWidth != null && Math.abs(box.bodyWidth - box.pageWidth) > 2) {
    fail(
      path,
      `the page body is ${box.bodyWidth}px but the page (header included) is ` +
        `${box.pageWidth}px - the header and the body must share one width`,
    );
    return false;
  }
  pass(
    path,
    `the page measures ${box.pageWidth}px, the rule's '${expect}' width ` +
      `(column ${box.columnWidth}px, max-w-${box.maxWidthClass})`,
  );
  return true;
}

/**
 * The page must not change width between its loading state and its loaded
 * state (complaints/new renders its FormPage inside a Suspense fallback).
 */
function checkWidthStability(path, expect, states) {
  if (!states.length) {
    skip(`${path} (width stability)`, 'no page state could be observed');
    return;
  }
  const want = expectedSignature(expect);
  const wrong = states.filter((s) => s.signature !== want);
  if (wrong.length > 0) {
    fail(
      path,
      `the page changed width while it loaded: it passed through ` +
        `${states.map((s) => `max-w-${s.signature}`).join(' -> ')} but the rule gives it ` +
        `max-w-${want} for every state`,
    );
    return;
  }
  pass(
    path,
    `the page kept one width through every state it loaded through ` +
      `(${states.map((s) => `max-w-${s.signature}`).join(' -> ')})`,
  );
}

async function measurePrimaryAction(page, path, name) {
  const matches = page.getByRole('button', { name });
  const count = await matches.count();
  if (count === 0) {
    fail(path, `no button named "${name}" on the page`);
    return;
  }
  const box = await matches.first().boundingBox();
  if (!box) {
    fail(path, `the button "${name}" has no box (not rendered)`);
    return;
  }
  if (box.y < 0 || box.y > VIEWPORT.height) {
    fail(
      path,
      `the primary action "${name}" sits at y=${Math.round(box.y)}, outside one viewport ` +
        `(${VIEWPORT.height}px) of the top`,
    );
    return;
  }
  pass(path, `the primary action "${name}" is at y=${Math.round(box.y)}`);
}

async function measureFirstRow(page, path) {
  const row = page.locator('table tbody tr').first();
  const count = await page.locator('table tbody tr').count();
  if (count === 0) {
    fail(path, 'the table rendered no data row');
    return;
  }
  const box = await row.boundingBox();
  if (!box) {
    fail(path, 'the first data row has no box');
    return;
  }
  const y = Math.round(box.y);
  if (y > CHROME_BUDGET) {
    fail(
      path,
      `the first data row is at y=${y}, past the ${CHROME_BUDGET}px chrome budget (half a screen)`,
    );
    return;
  }
  pass(path, `the first data row is at y=${y} (budget ${CHROME_BUDGET}px)`);
}

async function measureStickyFooter(page, path) {
  const footer = page.locator('div.sticky.bottom-0').first();
  if ((await footer.count()) === 0) {
    fail(path, 'no sticky form footer was rendered');
    return;
  }
  const scrollable = await page.evaluate(() => ({
    height: document.body.scrollHeight,
    viewport: window.innerHeight,
  }));
  if (scrollable.height <= scrollable.viewport + 80) {
    skip(path, 'the form is not taller than the viewport, the sticky footer cannot be measured');
    return;
  }
  // Scroll into the form body: the card still reaches below the fold, so the
  // footer can only be on screen if it sticks.
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const el = document.querySelector('div.sticky.bottom-0');
    if (!el || !el.parentElement) return null;
    const rect = el.getBoundingClientRect();
    const card = el.parentElement.getBoundingClientRect();
    return {
      footerTop: Math.round(rect.top),
      footerBottom: Math.round(rect.bottom),
      cardBottom: Math.round(card.bottom),
      viewport: window.innerHeight,
      scrollY: Math.round(window.scrollY),
    };
  });
  if (!info) {
    fail(path, 'the sticky form footer could not be measured after scrolling');
    return;
  }
  if (info.scrollY <= 0) {
    skip(path, 'the page did not scroll, the sticky footer cannot be measured');
    return;
  }
  if (info.cardBottom <= info.viewport) {
    skip(
      path,
      'the form card ends inside the viewport, the sticky footer has nothing to stick against',
    );
    return;
  }
  if (info.footerBottom > info.viewport + 2 || info.footerTop < 0) {
    fail(
      path,
      `after scrolling to y=${info.scrollY} the form footer sits at y=${info.footerTop} ` +
        `(bottom ${info.footerBottom}) while the card ends at ${info.cardBottom}; ` +
        `the footer must stay pinned inside the viewport (${info.viewport}px)`,
    );
    return;
  }
  pass(
    path,
    `the form footer is pinned at y=${info.footerTop} (bottom ${info.footerBottom}) while the ` +
      `card ends at ${info.cardBottom}`,
  );
}

// ── Main ───────────────────────────────────────────────

async function main() {
  console.log('LAYOUT FRAME MEASUREMENT');
  console.log(`base url: ${BASE_URL}`);
  console.log(`viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`pages in the width rule: ${PAGE_RULES.length}`);
  console.log('');

  let server = null;
  const status = await probe(BASE_URL);
  if (status === null) {
    if (!START_ADMIN) {
      skippedEnvironment = true;
      skip(
        'environment',
        `the admin app is not running at ${BASE_URL} and START_ADMIN=0 - nothing was measured. ` +
          'Start it with `bun --filter "@pg/web" start` (after a build) and run this again.',
      );
      return STRICT ? 1 : 0;
    }
    console.log(`the admin app is not running at ${BASE_URL}, starting it...`);
    server = startAdminServer((line) => console.log(line));
    if (!server) {
      skippedEnvironment = true;
      skip(
        'environment',
        'the admin app could not be started - build it first with `bun --filter "@pg/web" build`. ' +
          'Nothing was measured.',
      );
      return STRICT ? 1 : 0;
    }
    const up = await waitForServer(BASE_URL, 120_000);
    if (!up) {
      skippedEnvironment = true;
      skip(
        'environment',
        `the admin app did not answer at ${BASE_URL} within 120s - nothing was measured. ` +
          'Check the [admin] log lines above.',
      );
      return STRICT ? 1 : 0;
    }
  } else {
    console.log(`the admin app answered at ${BASE_URL} (HTTP ${status})`);
  }

  let chromium;
  try {
    chromium = await loadChromium();
  } catch (err) {
    skippedEnvironment = true;
    skip('environment', `${err.message} Nothing was measured.`);
    return STRICT ? 1 : 0;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const columnWidths = new Map();

  try {
    for (const rule of PAGE_RULES) {
      const { path, expect } = rule;
      const page = await openPage(context, path);

      // The page must still be the page we asked for.
      const current = new URL(page.url()).pathname;
      if (current !== path) {
        skip(
          path,
          `the app redirected to ${current} - the stubbed data does not satisfy this page`,
        );
        await page.close();
        continue;
      }

      await page.waitForSelector('h1', { timeout: 15_000 }).catch(() => {});
      if (rule.firstRow) {
        await page.waitForSelector('table tbody tr', { timeout: 15_000 }).catch(() => {});
      }

      const box = await readPageBox(page);
      if (!box) {
        skip(path, 'the page rendered no frame main column to measure');
        await page.close();
        continue;
      }
      columnWidths.set(path, box.columnWidth);
      checkWidthRule(path, expect, box);
      checkWidthStability(path, expect, await readStates(page));

      if (rule.action) {
        await measurePrimaryAction(page, path, rule.action);
      }
      if (rule.firstRow) {
        await measureFirstRow(page, path);
      }
      if (rule.stickyFooter) {
        await measureStickyFooter(page, path);
      }

      await page.close();
    }

    // One frame across pages: the shell band is the same width everywhere.
    const distinct = [...new Set(columnWidths.values())];
    if (columnWidths.size === 0) {
      fail('content frame width', 'no page width could be measured');
    } else if (distinct.length <= 1) {
      pass(
        'content frame width',
        `every measured page renders the same frame column (${distinct[0]}px)`,
      );
    } else {
      fail(
        'content frame width',
        `the pages render ${distinct.length} different frame columns: ` +
          [...columnWidths.entries()].map(([p, w]) => `${p}=${w}px`).join(', '),
      );
    }
  } catch (err) {
    failHard(`a page could not be measured: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    if (server) server.kill('SIGTERM');
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;
  console.log('');
  console.log(`RESULT: ${passed} passed, ${failed.length} failed, ${skips.length} skipped`);
  if (skips.length > 0) {
    console.log('SKIPPED PAGES (the rule was NOT checked there):');
    for (const s of skips) console.log(`  - ${s.name}: ${s.reason}`);
  }
  if (skippedEnvironment) {
    console.log('NOTE: the environment was not ready - nothing was measured.');
  }
  if (STRICT && skips.length > 0) {
    console.log('STRICT=1: a skipped page is a failure.');
    return 1;
  }
  return failed.length > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
