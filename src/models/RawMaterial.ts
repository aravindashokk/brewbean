import { Schema, model } from 'mongoose';
import type { IRawMaterial } from './types.js';

const rmSchema = new Schema<IRawMaterial>({
  name: { type: String, required: true },
  vendor: String,
  purchaseQty: { type: Number, default: 0 },
  purchaseUnitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() }
});

export default model<IRawMaterial>('RawMaterial', rmSchema);
