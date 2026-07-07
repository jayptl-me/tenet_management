import { Schema, model, type Model } from 'mongoose';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ICounterDocument {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounterDocument>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<ICounterDocument> = model<ICounterDocument>('Counter', counterSchema);

/**
 * Atomic increment — returns next sequence as padded invoice number.
 * Format: INV-YYYYMM-NNN
 */
export async function nextInvoiceNumber(month: string): Promise<string> {
  const yearMonth = month.replace('-', '');
  const counterId = `invoice-${yearMonth}`;

  const doc = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  );

  if (!doc) {
    throw new Error('Failed to generate invoice number');
  }

  const seq = String(doc.seq).padStart(3, '0');
  return `INV-${yearMonth}-${seq}`;
}
