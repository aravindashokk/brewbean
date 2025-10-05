import { Schema, model } from 'mongoose';
import type { IOrder } from './types.js';

const orderItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, required: true },
  basePrice: { type: Number, required: true },
  total: { type: Number, required: true }
});

const orderSchema = new Schema<IOrder>({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  items: [orderItemSchema],
  mode: { type: String, enum: ['SALE','FREE','RENTAL'], default: 'SALE' },
  baseTotal: { type: Number, required: true },
  createdAt: { type: Date, default: () => new Date() }
});
orderSchema.index({ customer: 1, createdAt: -1 });

export default model<IOrder>('Order', orderSchema);
