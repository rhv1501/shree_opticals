export type PaymentStatus = "Paid" | "Partial" | "Pending";

export interface EyePower {
  sph: string;
  cyl: string;
  axis: string;
  add: string;
  va: string;
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
