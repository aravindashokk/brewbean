import { Schema, model } from 'mongoose';
import type { IUser } from './types.js'; 

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin','sales','tech'], default: 'sales' },
  createdAt: { type: Date, default: () => new Date() }
});

export default model<IUser>('User', userSchema);
