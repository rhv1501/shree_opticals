import { db } from "@/lib/db";

/**
 * Syncs all unsynced sales (and their customers) to Google Sheets.
 * Returns { synced: number, pulled: number } or throws on API error.
 */
export async function syncToSheets(): Promise<{ synced: number; pulled: number }> {
  const [allCustomers, allSales, allDeleted] = await Promise.all([
    db.customers.toArray(),
    db.sales.toArray(),
    db.deletedRecords.toArray(),
  ]);

  const unsyncedSales = allSales.filter((s) => s.synced === false);
  const unsyncedCustomerIds = new Set(unsyncedSales.map((s) => s.customerId));
  const unsyncedCustomers = allCustomers.filter((c) =>
    c.synced === false || unsyncedCustomerIds.has(c.id)
  );

  const deletedCustomers = allDeleted.filter((d) => d.type === "customer").map((d) => d.id);
  const deletedSales = allDeleted.filter((d) => d.type === "sale").map((d) => d.id);

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customers: unsyncedCustomers,
      sales: unsyncedSales,
      deletedCustomers,
      deletedSales,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Sync failed");
  }

  // Mark synced in local DB and process pulled data
  let pulledCount = 0;
  await db.transaction("rw", db.sales, db.customers, db.deletedRecords, async () => {
    for (const sale of unsyncedSales) {
      await db.sales.update(sale.id, { synced: true });
    }
    for (const customer of unsyncedCustomers) {
      await db.customers.update(customer.id, { synced: true });
    }

    if (allDeleted.length > 0) {
      await db.deletedRecords.bulkDelete(allDeleted.map(d => d.id));
    }

    if (data.pulledCustomers) {
      const pulledCustomerIds = new Set(data.pulledCustomers.map((c: any) => c.id));
      const deletedCustomerSet = new Set(deletedCustomers);

      // Clean up customers deleted remotely
      const localCustomers = await db.customers.toArray();
      for (const local of localCustomers) {
        if (local.synced && !pulledCustomerIds.has(local.id) && !unsyncedCustomerIds.has(local.id)) {
           await db.customers.delete(local.id);
           pulledCount++;
        }
      }

      for (const pulled of data.pulledCustomers) {
        if (deletedCustomerSet.has(pulled.id)) continue; // don't restore just deleted
        const existing = await db.customers.get(pulled.id);
        if (!existing || new Date(pulled.updatedAt) > new Date(existing.updatedAt)) {
          await db.customers.put(pulled);
          pulledCount++;
        }
      }
    }

    if (data.pulledSales) {
      const pulledSaleIds = new Set(data.pulledSales.map((s: any) => s.id));
      const pushedSaleIds = new Set(unsyncedSales.map((s) => s.id));
      const deletedSaleSet = new Set(deletedSales);

      // Clean up sales deleted remotely
      const localSales = await db.sales.toArray();
      for (const local of localSales) {
        if (local.synced && !pulledSaleIds.has(local.id) && !pushedSaleIds.has(local.id)) {
           await db.sales.delete(local.id);
           pulledCount++;
        }
      }

      for (const pulled of data.pulledSales) {
        if (deletedSaleSet.has(pulled.id)) continue; // don't restore just deleted
        const existing = await db.sales.get(pulled.id);
        if (!existing) {
          await db.sales.put(pulled);
          pulledCount++;
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
            pulledCount++;
          }
        }
      }
    }
  });

  return { synced: unsyncedSales.length, pulled: pulledCount };
}
