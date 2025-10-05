import { Schema, model } from 'mongoose';
import type { ICustomer } from './types.js';

const customerSchema = new Schema<ICustomer>({
  name: { type: String, required: true },
  contactName: String,
  email: String,
  phone: String,
  address: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0,0] }
  },
  createdAt: { type: Date, default: () => new Date() }
});
customerSchema.index({ location: '2dsphere' });

export default model<ICustomer>('Customer', customerSchema);
