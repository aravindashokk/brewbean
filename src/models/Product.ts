import { Schema, model } from 'mongoose';
import type { IProduct } from './types.js';

const productSchema = new Schema<IProduct>({
  sku: String,
  name: { type: String, required: true },
  description: String,
  basePrice: { type: Number, required: true },
  mode: { type: String, enum: ['SALE','FREE','RENTAL'], default: 'SALE' },
  createdAt: { type: Date, default: () => new Date() }
});

export default model<IProduct>('Product', productSchema);
