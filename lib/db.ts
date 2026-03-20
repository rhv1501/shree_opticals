import Dexie, { type EntityTable } from 'dexie';
import { CustomerRecord } from '@/types';

export const db = new Dexie('OpticalShopDB') as Dexie & {
  records: EntityTable<CustomerRecord, 'id'>;
};

// Define indexes. We only index fields we frequently query or sort by.
db.version(1).stores({
  records: 'id, name, phone, date, status, synced, updatedAt',
});
