import { Types } from 'mongoose';

export type Mode = 'SALE' | 'FREE' | 'RENTAL';

export interface IUser {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  role: 'admin' | 'sales' | 'tech';
  createdAt?: Date;
}

export interface ICustomer {
  _id?: Types.ObjectId;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  createdAt?: Date;
}

export interface IProduct {
  _id?: Types.ObjectId;
  sku?: string;
  name: string;
  description?: string;
  basePrice: number;
  mode?: Mode; // default SALE
  createdAt?: Date;
}

export interface IOrderItem {
  product: Types.ObjectId; // product._id
  qty: number;
  basePrice: number; // snapshot
  total: number; // qty * basePrice
}

export interface IOrder {
  _id?: Types.ObjectId;
  customer: Types.ObjectId;
  items: IOrderItem[];
  mode: Mode;
  baseTotal: number;
  createdAt?: Date;
}

export interface ISpareUsed {
  rawMaterial: Types.ObjectId; // rawMaterials._id
  qty: number;
  unitCost: number;
  totalCost: number;
}

export interface IService {
  _id?: Types.ObjectId;
  customer: Types.ObjectId;
  jobDesc?: string;
  spares: ISpareUsed[];
  serviceCharge: number;
  createdAt?: Date;
}

export interface IVisit {
  _id?: Types.ObjectId;
  refType: 'ORDER' | 'SERVICE' | 'OTHER';
  refId?: Types.ObjectId;
  customer: Types.ObjectId;
  user: Types.ObjectId;
  date: Date;
  distanceKm: number;
  costPerKm: number;
  totalTravelCost: number; // distanceKm * costPerKm (snapshot)
  createdAt?: Date;
}

export interface IRawMaterial {
  _id?: Types.ObjectId;
  name: string;
  vendor?: string;
  purchaseQty: number;
  purchaseUnitCost: number;
  totalCost: number; // purchaseQty * purchaseUnitCost
  createdAt?: Date;
}

export interface IExpense {
  _id?: Types.ObjectId;
  type: 'RENT' | 'OTHER';
  description?: string;
  amount: number;
  month: string; // '2025-09'
  createdAt?: Date;
}
