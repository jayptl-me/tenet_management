# Phase 4: Payment & Invoice System (UPI QR + On-Demand PDF)

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** Complete payment lifecycle: invoice generation -> UPI QR display -> tenant pay via any UPI app -> UTR submission -> admin verification -> on-demand PDF invoice streaming -> direct WhatsApp sharing links.
**Estimated:** 6-7 days
**Depends On:** Phase 3 (core API routes)
**Package Manager:** bun

---

## Architecture Decisions

| Decision             | Choice                                                                              | Rationale                                                                |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| QR generation        | `qrcode` npm package, server-side, base64 PNG                                       | No client-side dependency, works in Flutter webview                      |
| UPI deep link format | `upi://pay?pa={upiId}&pn={name}&am={amount}&tn={note}&tr={ref}`                     | Universal, works with all Indian UPI apps                                |
| PDF engine           | `@react-pdf/renderer` streaming to response                                         | On-demand generation, no file storage, GST-compliant                     |
| WhatsApp sharing     | Direct `wa.me` / `whatsapp://send` URLs                                             | Free, no Business API, no provider lock-in, no templates                 |
| Generated artifacts  | Store source data only; generate PDFs, QR images, and share URLs on demand          | Avoids storing derived files and keeps corrections immediately reflected |
| Invoice numbering    | `INV-YYYYMM-NNN` with atomic counter via `findOneAndUpdate` on a Counter collection | Race-condition safe, human-readable                                      |
| Scheduled jobs       | `node-cron` with timezone support                                                   | Lightweight, no external scheduler                                       |
| Payment status flow  | pending -> partial -> pending_verification -> paid/rejected                         | Supports partial collection and clear audit trail                        |
| Refunds              | Manual checkout notes (confirmed final)                                             | Manual workflow confirmed as correct; no automation needed               |

---

## Step 4.1: Invoice Number Counter

### File: `apps/api/src/models/counter.ts`

```typescript
import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., "invoice-202607"
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);

// Atomic increment — returns next sequence number
export async function nextInvoiceNumber(month: string): Promise<string> {
  const yearMonth = month.replace('-', ''); // "2026-07" → "202607"
  const counterId = `invoice-${yearMonth}`;

  const doc = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  const seq = String(doc.seq).padStart(3, '0');
  return `INV-${yearMonth}-${seq}`;
}
```

---

## Step 4.2: UPI QR Utility

### File: `apps/api/src/lib/upi.ts`

```typescript
import QRCode from 'qrcode';

interface UpiParams {
  upiId: string;
  payeeName: string;
  amount?: number;
  transactionNote?: string;
  transactionRef?: string;
}

export function generateUpiDeepLink(params: UpiParams): string {
  const { upiId, payeeName, amount, transactionNote, transactionRef } = params;

  let link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&mode=02`;

  if (amount) link += `&am=${amount.toFixed(2)}`;
  if (transactionNote) link += `&tn=${encodeURIComponent(transactionNote)}`;
  if (transactionRef) link += `&tr=${encodeURIComponent(transactionRef)}`;

  return link;
}

export async function generateQrDataUrl(params: UpiParams): Promise<string> {
  const deepLink = generateUpiDeepLink(params);
  return QRCode.toDataURL(deepLink, {
    width: 400,
    margin: 2,
    color: { dark: '#1C1917', light: '#FFFFFF' },
  });
}

export function generateTransactionRef(invoiceId: string): string {
  // Short ref: last 8 chars of invoiceId + timestamp
  const short = invoiceId.slice(-8);
  return `PG-${short}`;
}
```

---

## Step 4.3: Invoice Service

### File: `apps/api/src/services/invoice.service.ts`

Core logic:

```typescript
export async function generateMonthlyInvoices(
  month: string,
): Promise<{ generated: number; skipped: number }> {
  let generated = 0;
  let skipped = 0;

  const activeTenants = await Tenant.find({ isActive: true }).populate('room').lean();

  for (const tenant of activeTenants) {
    // Check if invoice already exists for this tenant+month
    const existing = await Invoice.findOne({ tenantId: tenant._id, month });
    if (existing) {
      skipped++;
      continue;
    }

    const invoiceNumber = await nextInvoiceNumber(month);

    // Calculate electricity share if bill distributed
    const electricityAmount = await calculateElectricityShare(tenant._id.toString(), month);

    const lineItems = [{ description: 'Room Rent', amount: tenant.monthlyRent }];

    if (electricityAmount > 0) {
      lineItems.push({ description: 'Electricity Charges', amount: electricityAmount });
    }

    const invoice = await Invoice.create({
      invoiceNumber,
      tenantId: tenant._id,
      month,
      lineItems,
      rentAmount: tenant.monthlyRent,
      electricityAmount,
      otherCharges: 0,
      totalAmount: tenant.monthlyRent + electricityAmount,
      status: 'sent',
    });

    // Create pending payment record
    await Payment.create({
      tenantId: tenant._id,
      invoiceId: invoice._id,
      amount: invoice.totalAmount,
      type: 'rent',
      method: 'upi',
      status: 'pending',
      month,
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10), // 10th of month
    });

    generated++;
  }

  return { generated, skipped };
}

async function calculateElectricityShare(tenantId: string, month: string): Promise<number> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return 0;

  const bill = await ElectricityBill.findOne({ month, status: 'distributed' });
  if (!bill) return 0;

  const roomEntry = bill.roomEntries.find((e) => e.roomId.toString() === tenant.roomId.toString());
  if (!roomEntry) return 0;

  // Divide room amount by active tenants in that room for that month
  const activeRoommates = await Tenant.countDocuments({
    roomId: tenant.roomId,
    isActive: true,
    moveInDate: { $lte: new Date(month + '-01') },
  });

  return activeRoommates > 0 ? Math.round(roomEntry.amount / activeRoommates) : 0;
}
```

---

## Step 4.4: Payment Routes

### File: `apps/api/src/routes/payments.ts`

Key endpoints:

| Method | Path                                  | Auth       | Description                                          |
| ------ | ------------------------------------- | ---------- | ---------------------------------------------------- |
| GET    | `/payments`                           | admin      | Paginated, filterable (status, month, tenantId)      |
| GET    | `/payments/summary`                   | admin      | Current month collection stats + 6-month trend       |
| GET    | `/payments/my`                        | tenant     | Own payment history                                  |
| GET    | `/payments/qr-code`                   | tenant     | Dynamic QR for invoice (query: `?invoiceId=`)        |
| POST   | `/payments/offline`                   | admin      | Record cash/bank_transfer payment                    |
| POST   | `/payments/submit-utr`                | tenant     | Submit UTR + screenshot after UPI payment            |
| POST   | `/payments/verify-utr/:paymentId`     | admin      | Approve/reject UTR, update invoice status            |
| GET    | `/payments/pending-verification`      | admin      | All payments awaiting UTR review                     |
| GET    | `/invoices/:id/payment-status`        | admin/self | Paid amount, remaining amount, and payment breakdown |
| GET    | `/invoices/:id/whatsapp-url`          | admin/self | Direct WhatsApp URL with invoice PDF link            |
| GET    | `/payments/:id/whatsapp-reminder-url` | admin      | Direct WhatsApp URL for reminder text                |

### QR Code Endpoint Logic

```typescript
payments.get('/qr-code', authGuard, tenantOnly, async (c) => {
  const invoiceId = c.req.query('invoiceId');
  if (!invoiceId) return badRequest(c, 'invoiceId query parameter required');

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return notFound(c, 'Invoice');

  // Verify ownership
  const user = c.get('user');
  const tenant = await Tenant.findOne({ userId: user.id });
  if (!tenant || tenant._id.toString() !== invoice.tenantId.toString()) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your invoice' } },
      403,
    );
  }

  const appConfig = await AppConfig.findOne();
  const upiId = appConfig?.upiId || env.DEFAULT_UPI_ID;
  const payeeName = appConfig?.upiPayeeName || env.DEFAULT_UPI_PAYEE_NAME;

  const qrDataUrl = await generateQrDataUrl({
    upiId,
    payeeName,
    amount: invoice.totalAmount,
    transactionNote: `Rent ${invoice.month} - ${invoice.invoiceNumber}`,
    transactionRef: generateTransactionRef(invoice._id.toString()),
  });

  const deepLink = generateUpiDeepLink({
    upiId,
    payeeName,
    amount: invoice.totalAmount,
    transactionNote: `Rent ${invoice.month}`,
    transactionRef: generateTransactionRef(invoice._id.toString()),
  });

  return c.json({
    success: true,
    data: {
      qrDataUrl,
      upiDeepLink: deepLink,
      amount: invoice.totalAmount,
      upiId,
      payeeName,
      invoiceNumber: invoice.invoiceNumber,
      transactionRef: generateTransactionRef(invoice._id.toString()),
    },
  });
});
```

### UTR Submission Logic

```typescript
payments.post('/submit-utr', authGuard, tenantOnly, async (c) => {
  const body = await c.req.parseBody();
  const { invoiceId, utrNumber } = body;

  const payment = await Payment.findOne({ invoiceId, tenantId: tenant._id });

  if (!payment) return notFound(c, 'Payment record not found for this invoice');
  if (payment.status !== 'pending') {
    return badRequest(c, `Payment already ${payment.status}`);
  }

  // Upload screenshot if provided
  let screenshotUrl: string | null = null;
  if (body.screenshot && body.screenshot instanceof File) {
    screenshotUrl = await uploadToCloudinary(body.screenshot, 'payment-screenshots');
  }

  payment.utrNumber = String(utrNumber).toUpperCase().trim();
  payment.screenshotUrl = screenshotUrl;
  payment.status = 'pending_verification';
  await payment.save();

  // Emit SSE event to admin
  eventBus.emit('payment_submitted', {
    paymentId: payment._id,
    tenantName: user.name,
    amount: payment.amount,
    utrNumber: payment.utrNumber,
  });

  return c.json({ success: true, data: { message: 'UTR submitted for verification' } });
});
```

---

## Step 4.5: Partial Payments, WhatsApp Links, and Generated Artifacts

### Partial Payment Rules

When the amount collected is less than the invoice total:

1. Create a Payment record for the collected amount.
2. Mark the invoice `partial` when paid amount is greater than 0 and less than total.
3. Keep additional payments linked to the same invoice until the sum reaches the invoice total.
4. Mark invoice `paid` only when approved/recorded payments cover the full invoice amount.
5. `GET /invoices/:id/payment-status` returns `totalAmount`, `paidAmount`, `remainingAmount`, and linked payments.

Do not overwrite the original invoice total. Corrections happen through additional line items or admin adjustments with audit logs.

### WhatsApp Direct URL Utility

**File:** `apps/web/src/lib/whatsapp.ts`

```typescript
export function generateWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
```

**Usage rules:**

- No WhatsApp Business API.
- No WhatsApp API key.
- No SMS provider dependency.
- Admin buttons open direct links or copy message text.
- Flutter uses `url_launcher` to open the direct URL.
- Generated text must contain no emoji.

**Message example:**

```typescript
const invoicePdfUrl = `${apiBaseUrl}/invoices/${invoice.id}/pdf`;
const message = [
  `Invoice ${invoice.invoiceNumber} for ${invoice.month}`,
  `Amount: Rs.${invoice.totalAmount}`,
  `Download PDF: ${invoicePdfUrl}`,
  `Pay using UPI ID: ${upiId}`,
].join('\n');
```

### Generated Artifact Contract

- Invoice PDFs are streamed from `/invoices/:id/pdf`; do not store PDF files.
- Receipt PDFs are generated from Payment and Invoice data; do not store receipt PDFs.
- UPI QR images are generated from UPI payment data; do not store QR files.
- WhatsApp URLs are generated from current data; do not store URLs except optional audit/message history.
- Short-lived in-memory or CDN caching is allowed only when invalidated by invoice/payment updates.

### Refund Scope

Refund automation is deferred. Checkout keeps the deposit amount, pending dues, damage notes, and admin remarks so that the admin can review dues and damages manually, which is confirmed as the correct, cost-effective final design. For now, admins handle refunds manually outside the system and record notes/audit trails directly on the tenant record.

---

## Step 4.6: Invoice PDF Template & Route

### File: `apps/api/src/templates/InvoicePdf.tsx`

React component using `@react-pdf/renderer`:

```tsx
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.ttf',
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Inter', fontSize: 11, color: '#1C1917' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 700, color: '#D97706' },
  subtitle: { fontSize: 10, color: '#78716C' },
  section: { marginBottom: 20 },
  table: { marginTop: 10 },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #E7E5E4', paddingVertical: 6 },
  tableHeader: { fontWeight: 700, backgroundColor: '#F5F5F4' },
  colDesc: { flex: 3 },
  colAmount: { flex: 1, textAlign: 'right' },
  total: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    paddingTop: 10,
    borderTop: '2px solid #1C1917',
  },
  totalLabel: { fontSize: 14, fontWeight: 700, marginRight: 20 },
  totalValue: { fontSize: 14, fontWeight: 700 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#A8A29E',
    textAlign: 'center',
  },
  qrCode: { width: 80, height: 80, alignSelf: 'flex-end', marginTop: 10 },
});

interface InvoicePdfProps {
  invoice: {
    invoiceNumber: string;
    month: string;
    generatedAt: string;
    lineItems: { description: string; amount: number }[];
    rentAmount: number;
    electricityAmount: number;
    otherCharges: number;
    totalAmount: number;
  };
  tenant: {
    name: string;
    roomNumber: string;
    floorLabel: string;
  };
  appConfig: {
    pgName: string;
    address: { line1: string; city: string; state: string; pincode: string };
    phone: string;
    email: string;
    upiId: string;
    gstNumber?: string;
  };
  qrDataUrl?: string;
}

export function InvoicePdf({ invoice, tenant, appConfig, qrDataUrl }: InvoicePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{appConfig.pgName}</Text>
            <Text style={styles.subtitle}>
              {appConfig.address.line1}, {appConfig.address.city}
            </Text>
            <Text style={styles.subtitle}>
              Phone: {appConfig.phone} | Email: {appConfig.email}
            </Text>
            {appConfig.gstNumber && <Text style={styles.subtitle}>GST: {appConfig.gstNumber}</Text>}
          </View>
        </View>

        {/* Invoice Meta */}
        <View style={styles.section}>
          <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>INVOICE</Text>
          <Text>Invoice #: {invoice.invoiceNumber}</Text>
          <Text>Month: {invoice.month}</Text>
          <Text>Date: {new Date(invoice.generatedAt).toLocaleDateString('en-IN')}</Text>
          <Text>Tenant: {tenant.name}</Text>
          <Text>
            Room: {tenant.roomNumber} ({tenant.floorLabel})
          </Text>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colAmount}>Amount (₹)</Text>
          </View>
          {invoice.lineItems.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colAmount}>{item.amount.toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{invoice.totalAmount.toLocaleString('en-IN')}</Text>
        </View>

        {/* UPI QR */}
        {qrDataUrl && (
          <View style={{ marginTop: 20, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, marginBottom: 5 }}>Pay via UPI: {appConfig.upiId}</Text>
            <Image src={qrDataUrl} style={styles.qrCode} />
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          This is a computer-generated invoice. | {appConfig.pgName} | {appConfig.address.city}
        </Text>
      </Page>
    </Document>
  );
}
```

### PDF Streaming Route

```typescript
invoices.get('/:id/pdf', authGuard, selfOrAdmin(async (c) => {
  const invoiceId = c.req.param('id');
  const invoice = await Invoice.findById(invoiceId).populate('tenant');
  // ...ownership check...

  try {
    const pdfStream = await ReactPDF.renderToStream(
      <InvoicePdf
        invoice={invoice}
        tenant={{ name, roomNumber, floorLabel }}
        appConfig={await AppConfig.findOne()}
      />
    );

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    c.header('Cache-Control', 'no-cache');

    return c.body(pdfStream as any);
  } catch (renderErr) {
    logger.error({ err: renderErr, requestId: c.get('requestId') }, 'PDF render failed');
    return c.json({
      success: false,
      error: {
        code: 'PDF_GENERATION_FAILED',
        message: 'Failed to generate invoice PDF. Please try again.',
        requestId: c.get('requestId'),
      },
    }, 500);
  }
}));
```

---

## Step 4.7: Electricity Bill Routes

### File: `apps/api/src/routes/electricity.ts`

| Method | Path                          | Auth  | Description                                 |
| ------ | ----------------------------- | ----- | ------------------------------------------- |
| GET    | `/electricity`                | admin | All bills, sorted by month desc             |
| GET    | `/electricity/:id`            | admin | Single bill detail                          |
| POST   | `/electricity`                | admin | Create bill with readings (status: draft)   |
| PUT    | `/electricity/:id`            | admin | Update readings before finalize             |
| POST   | `/electricity/:id/finalize`   | admin | Lock readings, mark finalized               |
| POST   | `/electricity/:id/distribute` | admin | Calculate per-tenant share, add to invoices |

Distribution logic: for each room entry, divide `amount` by active tenants in that room for that month. Create/update invoice with electricity line item.

---

## Step 4.8: Scheduled Jobs

### File: `apps/api/src/jobs/scheduler.ts`

```typescript
import cron from 'node-cron';
import { generateMonthlyInvoices } from '../services/invoice.service.js';
import { logger } from '../lib/logger.js';

// ── 1st of month, 9 AM IST: Generate invoices ───────────
cron.schedule(
  '0 9 1 * *',
  async () => {
    const month = new Date().toISOString().slice(0, 7);
    logger.info('Starting monthly invoice generation', { month });
    try {
      const result = await generateMonthlyInvoices(month);
      logger.info('Invoice generation complete', result);
    } catch (err) {
      logger.error({ err }, 'Invoice generation failed');
    }
  },
  { timezone: 'Asia/Kolkata' },
);

// ── 5th, 10th, 15th, 10 AM: Payment reminders ───────────
cron.schedule(
  '0 10 5,10,15 * *',
  async () => {
    /* ... */
  },
  { timezone: 'Asia/Kolkata' },
);

// ── Daily 8 AM: Mark overdue payments ───────────────────
cron.schedule(
  '0 8 * * *',
  async () => {
    const overdue = await Payment.updateMany(
      {
        status: 'pending',
        dueDate: { $lt: new Date() },
      },
      { status: 'overdue' },
    );
    if (overdue.modifiedCount > 0) {
      logger.info({ count: overdue.modifiedCount }, 'Marked overdue payments');
    }
  },
  { timezone: 'Asia/Kolkata' },
);

logger.info('Scheduled jobs registered');
```

Register in `apps/api/src/index.ts`:

```typescript
import './jobs/scheduler.js';
```

---

## Verification Checklist

- [ ] `POST /invoices/generate-bulk` → creates invoices for all active tenants
- [ ] Invoice number format: `INV-YYYYMM-NNN`, sequential, no gaps
- [ ] Duplicate month invoice generation → skipped, not error
- [ ] `GET /payments/qr-code?invoiceId=X` → returns QR base64 + UPI deep link
- [ ] QR code scannable by Google Pay/PhonePe/Paytm
- [ ] UPI deep link opens UPI app on mobile
- [ ] Partial payment updates invoice to `partial` and exposes remaining balance
- [ ] `POST /payments/submit-utr` → payment status changes to `pending_verification`
- [ ] Duplicate UTR → 409 conflict
- [ ] `POST /payments/verify-utr/:id` → admin approves → status `paid`, invoice updated
- [ ] `POST /payments/verify-utr/:id` → admin rejects → notification sent to tenant
- [ ] `GET /invoices/:id/pdf` → streams PDF, opens in browser
- [ ] PDF is generated on demand and no PDF file is stored
- [ ] WhatsApp invoice/reminder actions generate direct URLs and require no API key
- [ ] WhatsApp generated text contains no emoji
- [ ] PDF renders: PG name, address, line items, total, UPI QR, GST number if configured
- [ ] PDF ownership: tenant cannot download another tenant's invoice
- [ ] Electricity distribution: per-room amount correctly divided by roommates
- [ ] Scheduled job: manual trigger for testing, cron for production
- [ ] Overdue mark: payments past due date auto-marked `overdue`
- [ ] `bun run typecheck` passes

---

## Edge Cases Summary

| Scenario                                    | Handling                                                |
| ------------------------------------------- | ------------------------------------------------------- |
| Invoice generation with no tenants          | Returns `{ generated: 0, skipped: 0 }`                  |
| UTR with special characters                 | Normalized to uppercase alphanumeric only               |
| Payment screenshot >5MB                     | Cloudinary rejects, error returned                      |
| Invoice PDF for deleted tenant              | Invoice data still valid, renders with what's available |
| Race condition on invoice counter           | `findByIdAndUpdate` with `$inc` is atomic               |
| Electricity bill without finalized readings | Cannot distribute — returns 400                         |
| PDF for invoice with zero total             | Still renders correctly, shows ₹0.00                    |
| QR for already-paid invoice                 | Allowed (for receipt purposes) — amount still shown     |
| Admin offline payment recording             | Set status directly to `paid`, bypass UTR flow          |
| WhatsApp not installed                      | Copy message fallback shown                             |
| Refund request at checkout                  | Manual notes/audit only (confirmed final)               |
