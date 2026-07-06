/**
 * Zero-dependency WhatsApp share URL builder.
 * Uses https://wa.me/ deep link — no API keys, no templates, no paid messaging.
 *
 * Fallback: if WhatsApp is not installed, the calling client should
 * copy the text to clipboard and show a toast.
 */

/**
 * Builds a wa.me URL with a pre-filled message.
 * @param phone Indian mobile number in +91XXXXXXXXXX format (or international)
 * @param text The message to pre-fill
 * @returns Full wa.me URL
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  // Strip any non-digit chars except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleaned}?text=${encodedText}`;
}

/**
 * Formats invoice details as a WhatsApp share text.
 */
export function formatInvoiceShareText(params: {
  tenantName: string;
  roomNumber: string;
  month: string;
  totalAmount: number;
  invoiceNumber: string;
  upiId: string;
}): string {
  const lines = [
    `Hello ${params.tenantName},`,
    '',
    `Your invoice for ${params.month} is ready:`,
    `Room: ${params.roomNumber}`,
    `Invoice: ${params.invoiceNumber}`,
    `Amount Due: Rs.${params.totalAmount.toLocaleString('en-IN')}`,
    '',
    `Pay via UPI: ${params.upiId}`,
    '',
    'Please submit your UTR reference after payment.',
  ];
  return lines.join('\n');
}

/**
 * Formats a generic payment reminder as WhatsApp share text.
 */
export function formatPaymentReminderText(params: {
  tenantName: string;
  month: string;
  amount: number;
  dueDate: string;
  upiId: string;
}): string {
  const lines = [
    `Hello ${params.tenantName},`,
    '',
    `Reminder: Your payment of Rs.${params.amount.toLocaleString('en-IN')} for ${params.month} is due by ${params.dueDate}.`,
    '',
    `Pay via UPI: ${params.upiId}`,
    '',
    'Please ignore if already paid.',
  ];
  return lines.join('\n');
}

/**
 * Formats an announcement or notice as WhatsApp share text.
 */
export function formatAnnouncementText(params: {
  title: string;
  content: string;
  pgName: string;
}): string {
  const lines = [`${params.pgName} - Announcement`, '', `${params.title}`, '', params.content];
  return lines.join('\n');
}

/**
 * Formats an emergency alert for WhatsApp sharing.
 */
export function formatEmergencyAlertText(params: {
  title: string;
  message: string;
  pgName: string;
}): string {
  const lines = [
    `URGENT - ${params.pgName}`,
    '',
    `${params.title}`,
    '',
    params.message,
    '',
    'Please acknowledge this message immediately.',
  ];
  return lines.join('\n');
}
