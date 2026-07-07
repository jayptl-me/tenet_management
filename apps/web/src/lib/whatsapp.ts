export function generateWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * Opens WhatsApp with a pre-filled message, or copies the text if WhatsApp is unavailable.
 */
export async function shareViaWhatsApp(phone: string, text: string): Promise<void> {
  const url = generateWhatsAppUrl(phone, text);
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    await copyToClipboard(text);
  }
}
