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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
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
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  colMonth: { flex: 1.4 },
  colNumber: { flex: 1.6 },
  colAmount: { flex: 1.2, alignItems: 'flex-end' },
  colBalance: { flex: 1.2, alignItems: 'flex-end' },
  colStatus: { flex: 1 },
  cellText: {
    fontSize: 9,
    color: '#1A1A1A',
  },
  cellMono: {
    fontSize: 9,
    color: '#1A1A1A',
    fontFamily: 'Courier',
  },
  cellMuted: {
    fontSize: 9,
    color: '#666666',
  },
  totalsSection: {
    marginTop: 16,
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
    width: 140,
    textAlign: 'right',
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 9,
    width: 110,
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
    width: 140,
    textAlign: 'right',
    paddingRight: 12,
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
    width: 110,
    textAlign: 'right',
    fontFamily: 'Courier',
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
  emptyText: {
    fontSize: 9,
    color: '#999999',
    fontStyle: 'italic',
    paddingVertical: 8,
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

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '--';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return '--';
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
  return `${months[parseInt(m ?? '1', 10) - 1] ?? '?'} ${y}`;
}

// ── Types ───────────────────────────────────────────────

export interface StatementInvoiceRow {
  invoiceNumber: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  status: string;
}

export interface StatementPaymentRow {
  amount: number;
  method: string;
  status: string;
  paidAt?: string | null;
  month?: string | null;
}

export interface StatementData {
  tenant: Record<string, unknown>;
  stay: {
    moveInDate: string | Date | null;
    moveOutDate: string | Date | null;
    isActive: boolean;
  };
  monthlyRent: number;
  depositPaid: number;
  invoices: StatementInvoiceRow[];
  payments: StatementPaymentRow[];
  totals: {
    invoiced: number;
    paid: number;
    outstanding: number;
    depositHeld: number;
  };
  generatedAt: string | Date;
}

// ── Component ───────────────────────────────────────────

interface StatementPdfProps {
  statement: StatementData;
  appConfig: Record<string, unknown>;
}

export function StatementPdf({ statement, appConfig }: StatementPdfProps) {
  const tenantInfo = (statement.tenant.userId as Record<string, unknown> | null) ?? {};
  const roomInfo = (statement.tenant.roomId as Record<string, unknown> | null) ?? {};

  const pgName = (appConfig.pgName as string) ?? 'PG Management';
  const address = appConfig.address as Record<string, unknown> | undefined;
  const addressLine = address
    ? [address.line1, address.line2, address.city, address.state, address.pincode]
        .filter(Boolean)
        .join(', ')
    : '';
  const pgPhone = (appConfig.phone as string) ?? '';
  const pgEmail = (appConfig.email as string) ?? '';

  const stayLabel = statement.stay.isActive
    ? `Active since ${formatDate(statement.stay.moveInDate)}`
    : `${formatDate(statement.stay.moveInDate)} to ${formatDate(statement.stay.moveOutDate)}`;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: { flex: 1 } },
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
          { style: { flex: 1, alignItems: 'flex-end' } },
          React.createElement(Text, { style: styles.title }, 'STATEMENT OF ACCOUNT'),
          React.createElement(
            Text,
            { style: styles.subtitle },
            `Generated ${formatDate(statement.generatedAt)}`,
          ),
        ),
      ),
      // Tenant info
      React.createElement(
        View,
        { style: styles.infoSection },
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoLabel }, 'Resident'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            (tenantInfo.name as string) ?? 'Unknown',
          ),
          React.createElement(Text, { style: styles.infoLabel }, 'Room / Bed'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            `${(roomInfo.roomNumber as string) ?? '--'} / Bed ${(statement.tenant.bedId as string) ?? '--'}`,
          ),
          React.createElement(Text, { style: styles.infoLabel }, 'Phone'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            (tenantInfo.phone as string) ?? '--',
          ),
        ),
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoLabel }, 'Stay Period'),
          React.createElement(Text, { style: styles.infoValue }, stayLabel),
          React.createElement(Text, { style: styles.infoLabel }, 'Monthly Rent'),
          React.createElement(Text, { style: styles.infoValue }, formatINR(statement.monthlyRent)),
          React.createElement(Text, { style: styles.infoLabel }, 'Status'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            statement.stay.isActive ? 'ACTIVE' : 'CHECKED OUT',
          ),
        ),
      ),
      // Invoices table
      React.createElement(Text, { style: styles.sectionTitle }, 'Invoices'),
      statement.invoices.length === 0
        ? React.createElement(Text, { style: styles.emptyText }, 'No invoices on record.')
        : React.createElement(
            View,
            null,
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colMonth] },
                'Month',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colNumber] },
                'Invoice',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colAmount] },
                'Total',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colBalance] },
                'Balance',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colStatus] },
                'Status',
              ),
            ),
            ...statement.invoices.map((inv) =>
              React.createElement(
                View,
                { style: styles.tableRow },
                React.createElement(Text, { style: styles.cellText }, getMonthLabel(inv.month)),
                React.createElement(Text, { style: styles.cellMono }, inv.invoiceNumber),
                React.createElement(Text, { style: styles.cellMono }, formatINR(inv.totalAmount)),
                React.createElement(Text, { style: styles.cellMono }, formatINR(inv.remaining)),
                React.createElement(Text, { style: styles.cellMuted }, inv.status.toUpperCase()),
              ),
            ),
          ),
      // Payments table
      React.createElement(Text, { style: styles.sectionTitle }, 'Payments'),
      statement.payments.length === 0
        ? React.createElement(Text, { style: styles.emptyText }, 'No payments on record.')
        : React.createElement(
            View,
            null,
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colMonth] },
                'Date',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colNumber] },
                'Method',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colAmount] },
                'Amount',
              ),
              React.createElement(
                Text,
                { style: [styles.tableHeaderText, styles.colStatus] },
                'Status',
              ),
            ),
            ...statement.payments.map((p, i) =>
              React.createElement(
                View,
                { key: `payment-${i}`, style: styles.tableRow },
                React.createElement(Text, { style: styles.cellText }, formatDate(p.paidAt ?? null)),
                React.createElement(Text, { style: styles.cellMuted }, p.method.replace(/_/g, ' ')),
                React.createElement(Text, { style: styles.cellMono }, formatINR(p.amount)),
                React.createElement(Text, { style: styles.cellMuted }, p.status.toUpperCase()),
              ),
            ),
          ),
      // Totals
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Total invoiced'),
          React.createElement(
            Text,
            { style: styles.totalValue },
            formatINR(statement.totals.invoiced),
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Total paid'),
          React.createElement(Text, { style: styles.totalValue }, formatINR(statement.totals.paid)),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Deposit held'),
          React.createElement(
            Text,
            { style: styles.totalValue },
            formatINR(statement.totals.depositHeld),
          ),
        ),
        React.createElement(
          View,
          { style: styles.grandTotalRow },
          React.createElement(Text, { style: styles.grandTotalLabel }, 'Outstanding'),
          React.createElement(
            Text,
            { style: styles.grandTotalValue },
            formatINR(statement.totals.outstanding),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          `This is a computer-generated statement of account. | ${pgName}`,
        ),
      ),
    ),
  );
}
