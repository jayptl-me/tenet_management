import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// ── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '2 solid #E5E5E5',
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pgName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D97706',
    marginBottom: 4,
  },
  pgAddress: {
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: '#999999',
    textTransform: 'uppercase',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  infoValue: {
    fontSize: 10,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderTop: '1 solid #E5E5E5',
    borderBottom: '1 solid #E5E5E5',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  descriptionCol: {
    flex: 3,
    paddingRight: 8,
  },
  amountCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  descriptionText: {
    fontSize: 9,
    color: '#1A1A1A',
  },
  amountText: {
    fontSize: 9,
    color: '#1A1A1A',
    fontFamily: 'Courier',
  },
  totalsSection: {
    marginTop: 20,
    borderTop: '2 solid #E5E5E5',
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: '#666666',
    width: 120,
    textAlign: 'right',
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 9,
    width: 100,
    textAlign: 'right',
    fontFamily: 'Courier',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1 solid #E5E5E5',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
    width: 120,
    textAlign: 'right',
    paddingRight: 12,
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
    width: 100,
    textAlign: 'right',
    fontFamily: 'Courier',
  },
  paymentSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#FFF8F0',
    border: '1 solid #FDE68A',
    borderRadius: 4,
  },
  paymentTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 6,
  },
  paymentInfo: {
    fontSize: 8,
    color: '#78350F',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #E5E5E5',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#999999',
    textAlign: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 40,
    right: 40,
    fontSize: 24,
    color: '#E5E5E5',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    opacity: 0.5,
  },
});

// ── Helpers ─────────────────────────────────────────────

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | Date): string {
  if (!dateStr) return '--';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[parseInt(m ?? '1', 10) - 1]} ${y}`;
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'PAID',
  partial: 'PARTIALLY PAID',
  overdue: 'OVERDUE',
  cancelled: 'CANCELLED',
  sent: '',
  draft: 'DRAFT',
};

// ── Component ───────────────────────────────────────────

interface InvoicePdfProps {
  invoice: Record<string, unknown>;
  appConfig: Record<string, unknown>;
}

export function InvoicePdf({ invoice, appConfig }: InvoicePdfProps) {
  const tenantInfo = (invoice.tenantId as Record<string, unknown> | null) ?? {};
  const userInfo = (tenantInfo.userId as Record<string, unknown> | null) ?? {};
  const roomInfo = (tenantInfo.roomId as Record<string, unknown> | null) ?? {};

  const lineItems = (invoice.lineItems as Array<Record<string, unknown>>) ?? [];
  const statusLabel = STATUS_LABELS[(invoice.status as string) ?? ''] ?? '';
  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';

  const pgName = (appConfig.pgName as string) ?? 'PG Management';
  const address = appConfig.address as Record<string, unknown> | undefined;
  const addressLine = address
    ? [address.line1, address.line2, address.city, address.state, address.pincode]
        .filter(Boolean)
        .join(', ')
    : '';
  const pgPhone = (appConfig.phone as string) ?? '';
  const pgEmail = (appConfig.email as string) ?? '';
  const upiId = (appConfig.upiId as string) ?? '';
  const upiPayeeName = (appConfig.upiPayeeName as string) ?? pgName;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      statusLabel ? React.createElement(Text, { style: styles.statusBadge }, statusLabel) : null,
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerLeft },
          React.createElement(Text, { style: styles.pgName }, pgName),
          React.createElement(Text, { style: styles.pgAddress }, addressLine),
          pgPhone || pgEmail
            ? React.createElement(
                Text,
                { style: styles.pgAddress },
                [pgPhone, pgEmail].filter(Boolean).join(' | '),
              )
            : null,
        ),
        React.createElement(
          View,
          { style: styles.headerRight },
          React.createElement(Text, { style: styles.invoiceTitle }, 'INVOICE'),
          React.createElement(
            Text,
            { style: styles.invoiceNumber },
            invoice.invoiceNumber as string,
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.infoSection },
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoLabel }, 'Bill To'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            (userInfo.name as string) ?? 'Unknown Tenant',
          ),
          React.createElement(Text, { style: styles.infoLabel }, 'Room'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            (roomInfo.roomNumber as string) ?? '--',
          ),
          React.createElement(Text, { style: styles.infoLabel }, 'Phone'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            (userInfo.phone as string) ?? '--',
          ),
        ),
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoLabel }, 'Month'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            getMonthLabel(invoice.month as string),
          ),
          React.createElement(Text, { style: styles.infoLabel }, 'Date Generated'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            formatDate(invoice.generatedAt as string),
          ),
          React.createElement(Text, { style: styles.infoLabel }, 'Status'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            ((invoice.status as string) ?? '--').toUpperCase(),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(
          Text,
          { style: [styles.tableHeaderText, styles.descriptionCol] },
          'Description',
        ),
        React.createElement(Text, { style: [styles.tableHeaderText, styles.amountCol] }, 'Amount'),
      ),
      ...lineItems.map((item) =>
        React.createElement(
          View,
          { style: styles.tableRow },
          React.createElement(
            View,
            { style: styles.descriptionCol },
            React.createElement(
              Text,
              { style: styles.descriptionText },
              item.description as string,
            ),
          ),
          React.createElement(
            View,
            { style: styles.amountCol },
            React.createElement(
              Text,
              { style: styles.amountText },
              formatINR((item.amount as number) ?? 0),
            ),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Room Rent'),
          React.createElement(
            Text,
            { style: styles.totalValue },
            formatINR((invoice.rentAmount as number) ?? 0),
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Electricity'),
          React.createElement(
            Text,
            { style: styles.totalValue },
            formatINR((invoice.electricityAmount as number) ?? 0),
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Other Charges'),
          React.createElement(
            Text,
            { style: styles.totalValue },
            formatINR((invoice.otherCharges as number) ?? 0),
          ),
        ),
        React.createElement(
          View,
          { style: styles.grandTotalRow },
          React.createElement(Text, { style: styles.grandTotalLabel }, 'Total Due'),
          React.createElement(
            Text,
            { style: styles.grandTotalValue },
            formatINR((invoice.totalAmount as number) ?? 0),
          ),
        ),
      ),
      !isPaid && !isCancelled && upiId
        ? React.createElement(
            View,
            { style: styles.paymentSection },
            React.createElement(Text, { style: styles.paymentTitle }, 'Payment Information'),
            React.createElement(Text, { style: styles.paymentInfo }, `UPI ID: ${upiId}`),
            React.createElement(Text, { style: styles.paymentInfo }, `Payee: ${upiPayeeName}`),
            React.createElement(
              Text,
              { style: styles.paymentInfo },
              'Pay using any UPI app (GPay, PhonePe, Paytm). After payment, submit the UTR reference number in the app or portal.',
            ),
          )
        : null,
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          `This is a computer-generated invoice. | ${pgName}`,
        ),
      ),
    ),
  );
}
