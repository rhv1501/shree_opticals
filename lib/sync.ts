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

  // Mark synced in local DB and process pulled data
  await db.transaction("rw", db.sales, db.customers, async () => {
    for (const sale of unsyncedSales) {
      await db.sales.update(sale.id, { synced: true });
    }

    if (data.pulledCustomers) {
      for (const pulled of data.pulledCustomers) {
        const existing = await db.customers.get(pulled.id);
        if (!existing || new Date(pulled.updatedAt) > new Date(existing.updatedAt)) {
          await db.customers.put(pulled);
        }
      }
    }

    if (data.pulledSales) {
      const pushedSaleIds = new Set(unsyncedSales.map((s) => s.id));
      for (const pulled of data.pulledSales) {
        const existing = await db.sales.get(pulled.id);
        if (!existing) {
          await db.sales.put(pulled);
        } else if (!pushedSaleIds.has(pulled.id) && existing.synced) {
          if (new Date(pulled.updatedAt) > new Date(existing.updatedAt)) {
            // Overwrite with pulled data but try to preserve payment IDs if amounts match
            const mergedPayments = pulled.payments.map((p: any, i: number) => {
              const extP = existing.payments[i];
              if (extP && extP.amount === p.amount && extP.method === p.method) {
                return extP; // preserve original payment with its true ID
              }
              return p;
            });
            await db.sales.put({ ...pulled, payments: mergedPayments });
          }
        }
      }
    }
  });

  return { synced: unsyncedSales.length };
}
