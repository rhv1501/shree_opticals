import Dexie, { type EntityTable } from 'dexie';
import type { Customer, Sale, CustomerRecord, DeletedRecord } from '@/types';

export const db = new Dexie('OpticalShopDB') as Dexie & {
  customers: EntityTable<Customer, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  records: EntityTable<CustomerRecord, 'id'>; // legacy
  deletedRecords: EntityTable<DeletedRecord, 'id'>;
};

db.version(1).stores({
  records: 'id, name, phone, date, status, synced, updatedAt',
});

// v2: proper customer + sale tables
db.version(2).stores({
  records: 'id, name, phone, date, status, synced, updatedAt',
  customers: 'id, name, phone, createdAt, updatedAt',
  sales: 'id, customerId, customerName, date, status, synced, updatedAt',
});

// v3: soft deletes
db.version(3).stores({
  records: 'id, name, phone, date, status, synced, updatedAt',
  customers: 'id, name, phone, createdAt, updatedAt',
  sales: 'id, customerId, customerName, date, status, synced, updatedAt',
  deletedRecords: 'id, type, timestamp',
});
