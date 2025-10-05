import { Schema, model } from 'mongoose';
import type { IVisit } from './types.js';

const visitSchema = new Schema<IVisit>({
  refType: { type: String, enum: ['ORDER','SERVICE','OTHER'], default: 'OTHER' },
  refId: { type: Schema.Types.ObjectId },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: () => new Date() },
  distanceKm: { type: Number, default: 0 },
  costPerKm: { type: Number, default: 0 },
  totalTravelCost: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() }
});
visitSchema.index({ customer: 1, date: -1 });

export default model<IVisit>('Visit', visitSchema);
