import { Schema, model } from 'mongoose';
import type { IService } from './types.js';

const spareUsedSchema = new Schema({
  rawMaterial: { type: Schema.Types.ObjectId, ref: 'RawMaterial' },
  qty: Number,
  unitCost: Number,
  totalCost: Number
});

const serviceSchema = new Schema<IService>({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  jobDesc: String,
  spares: [spareUsedSchema],
  serviceCharge: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() }
});
serviceSchema.index({ customer: 1, createdAt: -1 });

export default model<IService>('Service', serviceSchema);
