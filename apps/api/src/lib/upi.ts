import QRCode from 'qrcode';
import { AppConfig } from '../models/appConfig.js';

export interface UpiParams {
  upiId: string;
  payeeName: string;
  amount?: number;
  transactionNote?: string;
  transactionRef?: string;
}

/**
 * Constructs a UPI deep link string per NPCI specification.
 * https://www.npci.org.in/UPI_Linking_Specifications.pdf
 */
export function generateUpiDeepLink(params: UpiParams): string {
  const parts: string[] = [`pa=${encodeURIComponent(params.upiId)}`];
  parts.push(`pn=${encodeURIComponent(params.payeeName)}`);

  if (params.amount !== undefined && params.amount > 0) {
    // UPI amount format: two decimal places, no currency symbol
    parts.push(`am=${params.amount.toFixed(2)}`);
  }

  if (params.transactionNote) {
    parts.push(`tn=${encodeURIComponent(params.transactionNote)}`);
  }

  if (params.transactionRef) {
    parts.push(`tr=${encodeURIComponent(params.transactionRef)}`);
  }

  // mode=02 = UPI Intent (opens any UPI app)
  parts.push('mode=02');

  return `upi://pay?${parts.join('&')}`;
}

/**
 * Generates both the UPI deep link and a QR code data URL for the given params.
 */
export async function generateUpiQr(params: UpiParams): Promise<{
  qrDataUrl: string;
  upiDeepLink: string;
}> {
  const upiDeepLink = generateUpiDeepLink(params);
  const qrDataUrl = await QRCode.toDataURL(upiDeepLink, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
  });

  return { qrDataUrl, upiDeepLink };
}

/**
 * Generates a short transaction reference from an invoice ID for the UPI `tr` parameter.
 * UPI `tr` field max length is 35 chars.
 */
export function generateTransactionRef(invoiceId: string): string {
  // Take last 8 chars of invoice ID (the sequential part) for readability
  const short = invoiceId.replace(/^INV-/, '').slice(-12);
  return `PG-${short}`;
}

/**
 * Fetches the PG's UPI config from AppConfig and generates a payment QR.
 * Caches the AppConfig lookup result per request (not across requests).
 */
export async function getPgUpiConfig(): Promise<{
  upiId: string;
  upiPayeeName: string;
}> {
  const config = await AppConfig.findOne().lean();
  if (!config || !config.upiId) {
    return {
      upiId: 'pgowner@upi',
      upiPayeeName: 'PG Management',
    };
  }
  return {
    upiId: config.upiId,
    upiPayeeName: config.upiPayeeName ?? config.pgName ?? 'PG Management',
  };
}
