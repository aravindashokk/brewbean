import { Schema, model } from 'mongoose';
import type { IExpense } from './types.js';

const expenseSchema = new Schema<IExpense>({
  type: { type: String, enum: ['RENT','OTHER'], default: 'OTHER' },
  description: String,
  amount: { type: Number, required: true },
  month: { type: String, required: true }, // 'YYYY-MM'
  createdAt: { type: Date, default: () => new Date() }
});

expenseSchema.index({ month: 1, type: 1 });

export default model<IExpense>('Expense', expenseSchema);
