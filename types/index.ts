export type PaymentStatus = "Paid" | "Partial" | "Pending";

export interface EyePower {
  sph?: string;
  cyl?: string;
  axis?: string;
  add?: string;
  va?: string;
}

export interface EyePowerRecord {
  right: EyePower;
  left: EyePower;
}

export interface PaymentEntry {
  id: string;
  amount: number;
  date: string;
  method: string;
}

// A customer profile – persists across multiple visits
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  eyePower?: EyePowerRecord;    // latest prescription on file
  createdAt: string;
  updatedAt: string;
}

// A single sale / visit for a customer
export interface Sale {
  id: string;
  customerId: string;           // FK → Customer.id
  customerName: string;         // denormalized for fast display
  customerPhone?: string;
  date: string;
  eyePower?: EyePowerRecord;    // prescription for this specific sale
  purchaseType: string[];
  totalAmount: number;
  advancePaid: number;
  payments: PaymentEntry[];
  balance: number;
  status: PaymentStatus;
  notes?: string;
  synced: boolean;
  updatedAt: string;
}

// Legacy – keep for backward compat during migration
export interface CustomerRecord {
  id: string;
  name: string;
  phone?: string;
  date: string;
  eyePower?: EyePowerRecord | string;
  purchaseType: string[];
  totalAmount: number;
  payments: PaymentEntry[];
  advancePaid: number;
  balance: number;
  status: PaymentStatus;
  synced: boolean;
  updatedAt: string;
}

export interface DeletedRecord {
  id: string; // The original id
  type: "sale" | "customer";
  timestamp: string;
}
