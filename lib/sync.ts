import { db } from "@/lib/db";

/**
 * Syncs all unsynced sales (and their customers) to Google Sheets.
 * Returns { synced: number } or throws on API error.
 */
export async function syncToSheets(): Promise<{ synced: number }> {
  const [allCustomers, allSales] = await Promise.all([
    db.customers.toArray(),
    db.sales.toArray(),
  ]);

  const unsyncedSales = allSales.filter((s) => s.synced === false);
  if (unsyncedSales.length === 0) return { synced: 0 };

  const unsyncedCustomerIds = new Set(unsyncedSales.map((s) => s.customerId));
  const unsyncedCustomers = allCustomers.filter((c) =>
    unsyncedCustomerIds.has(c.id)
  );

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customers: unsyncedCustomers, sales: unsyncedSales }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Sync failed");
  }

  // Mark synced in local DB
  await db.transaction("rw", db.sales, async () => {
    for (const sale of unsyncedSales) {
      await db.sales.update(sale.id, { synced: true });
    }
  });

  return { synced: unsyncedSales.length };
}
