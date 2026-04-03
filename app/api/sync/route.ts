/* eslint-disable @typescript-eslint/no-explicit-any */

import { google } from "googleapis";
import { NextResponse } from "next/server";
import Pusher from "pusher";

const CUSTOMER_HEADERS = [
  "Customer ID", "Name", "Phone", "Email",
  "Created At", "Updated At",
  "RE DV SPH", "RE DV CYL", "RE DV AXIS", "RE DV VA",
  "RE NV SPH", "RE NV CYL", "RE NV AXIS", "RE NV VA",
  "LE DV SPH", "LE DV CYL", "LE DV AXIS", "LE DV VA",
  "LE NV SPH", "LE NV CYL", "LE NV AXIS", "LE NV VA",
  "Lens", "Bifocals", "Usage Option"
];

const SALES_HEADERS = [
  "Sale ID", "Customer ID", "Customer Name", "Phone", "Date",
  "Total Amount", "Advance Paid", "Balance", "Status", "Payment Methods", "Notes",
  "Updated At",
  "RE DV SPH", "RE DV CYL", "RE DV AXIS", "RE DV VA",
  "RE NV SPH", "RE NV CYL", "RE NV AXIS", "RE NV VA",
  "LE DV SPH", "LE DV CYL", "LE DV AXIS", "LE DV VA",
  "LE NV SPH", "LE NV CYL", "LE NV AXIS", "LE NV VA",
  "Lens", "Bifocals", "Usage Option"
];

export async function POST(request: Request) {
  try {
    const { customers, sales, deletedCustomers, deletedSales } = await request.json();

    if (
      !process.env.GOOGLE_CLIENT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      return NextResponse.json(
        { success: false, error: "Google API credentials not configured in .env" },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^["']|["']$/g, ""),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // ── 1. Fetch current data ────────────────────────────────────────────────
    const [customersRes, salesRes, metaRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:AZ" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Sales!A:AZ" }),
      sheets.spreadsheets.get({ spreadsheetId }),
    ]);

    const existingCustomers = customersRes.data.values || [];
    const existingSales = salesRes.data.values || [];

    // Map ID -> rowIndex (0-indexed from the fetched values)
    const customerRowMap = new Map<string, number>();
    existingCustomers.forEach((row, i) => { if (row[0]) customerRowMap.set(row[0], i); });

    const saleRowMap = new Map<string, number>();
    existingSales.forEach((row, i) => { if (row[0]) saleRowMap.set(row[0], i); });

    // ── Helper formatters ────────────────────────────────────────────────────
    const formatCustomerRow = (c: any) => [
      c.id, c.name, c.phone || "", c.email || "",
      c.createdAt, c.updatedAt,
      // Ext fields:
      c.eyePower?.re?.dv?.sph || "", c.eyePower?.re?.dv?.cyl || "", c.eyePower?.re?.dv?.axis || "", c.eyePower?.re?.dv?.va || "",
      c.eyePower?.re?.nv?.sph || "", c.eyePower?.re?.nv?.cyl || "", c.eyePower?.re?.nv?.axis || "", c.eyePower?.re?.nv?.va || "",
      c.eyePower?.le?.dv?.sph || "", c.eyePower?.le?.dv?.cyl || "", c.eyePower?.le?.dv?.axis || "", c.eyePower?.le?.dv?.va || "",
      c.eyePower?.le?.nv?.sph || "", c.eyePower?.le?.nv?.cyl || "", c.eyePower?.le?.nv?.axis || "", c.eyePower?.le?.nv?.va || "",
      c.eyePower?.useLens || "", c.eyePower?.bifocals || "", c.eyePower?.usageOption || "",
    ];

    const formatSaleRow = (s: any) => [
      s.id, s.customerId, s.customerName, s.customerPhone || "",
      s.date,
      s.totalAmount, s.advancePaid, s.balance, s.status,
      s.payments?.map((p: any) => `${p.method}: ₹${p.amount}`).join("; ") || "",
      s.notes || "",
      s.updatedAt,
      // Ext fields:
      s.eyePower?.re?.dv?.sph || "", s.eyePower?.re?.dv?.cyl || "", s.eyePower?.re?.dv?.axis || "", s.eyePower?.re?.dv?.va || "",
      s.eyePower?.re?.nv?.sph || "", s.eyePower?.re?.nv?.cyl || "", s.eyePower?.re?.nv?.axis || "", s.eyePower?.re?.nv?.va || "",
      s.eyePower?.le?.dv?.sph || "", s.eyePower?.le?.dv?.cyl || "", s.eyePower?.le?.dv?.axis || "", s.eyePower?.le?.dv?.va || "",
      s.eyePower?.le?.nv?.sph || "", s.eyePower?.le?.nv?.cyl || "", s.eyePower?.le?.nv?.axis || "", s.eyePower?.le?.nv?.va || "",
      s.eyePower?.useLens || "", s.eyePower?.bifocals || "", s.eyePower?.usageOption || "",
    ];

    // ── 2. Segregate Updates and Appends ─────────────────────────────────────
    const valueUpdates: any[] = [];
    const customersToAppend: any[][] = [];
    const salesToAppend: any[][] = [];

    if (customers && customers.length > 0) {
      for (const c of customers) {
        if (customerRowMap.has(c.id)) {
          const rowIndex = customerRowMap.get(c.id)!;
          valueUpdates.push({
            range: `Customers!A${rowIndex + 1}:AZ${rowIndex + 1}`,
            values: [formatCustomerRow(c)],
          });
        } else {
          customersToAppend.push(formatCustomerRow(c));
        }
      }
    }

    if (sales && sales.length > 0) {
      for (const s of sales) {
        if (saleRowMap.has(s.id)) {
          const rowIndex = saleRowMap.get(s.id)!;
          valueUpdates.push({
            range: `Sales!A${rowIndex + 1}:AZ${rowIndex + 1}`,
            values: [formatSaleRow(s)],
          });
        } else {
          salesToAppend.push(formatSaleRow(s));
        }
      }
    }

    // ── 3. Execute Updates ───────────────────────────────────────────────────
    // Prepend header reset so headers are always maintained (fixes repeated Customer ID issue)
    valueUpdates.unshift({
      range: "Customers!A1:Y1", // Y is 25th column
      values: [CUSTOMER_HEADERS],
    });
    valueUpdates.unshift({
      range: "Sales!A1:AF1", // AF is 32th column
      values: [SALES_HEADERS],
    });

    if (valueUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: valueUpdates,
        },
      });
    }

    // ── 4. Execute Appends ───────────────────────────────────────────────────
    const appendRows = async (sheetName: string, headers: string[], rows: any[][], currentExisting: any[][]) => {
      if (rows.length === 0) return;
      const rowsToWrite = currentExisting.length === 0 ? [headers, ...rows] : rows;
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rowsToWrite },
      });
    };

    await appendRows("Customers", CUSTOMER_HEADERS, customersToAppend, existingCustomers);
    await appendRows("Sales", SALES_HEADERS, salesToAppend, existingSales);

    // ── 5. Execute Deletions ─────────────────────────────────────────────────
    const needsDeletion = (deletedCustomers?.length > 0) || (deletedSales?.length > 0);
    if (needsDeletion) {
      const customersSheetId = metaRes.data.sheets?.find(s => s.properties?.title === "Customers")?.properties?.sheetId;
      const salesSheetId = metaRes.data.sheets?.find(s => s.properties?.title === "Sales")?.properties?.sheetId;
      
      const deleteRequests: any[] = [];
      
      if (deletedCustomers && deletedCustomers.length > 0 && customersSheetId !== undefined) {
        const indicesToDelete: number[] = [];
        for (let i = 1; i < existingCustomers.length; i++) {
          if (deletedCustomers.includes(existingCustomers[i][0])) indicesToDelete.push(i);
        }
        indicesToDelete.sort((a, b) => b - a);
        for (const idx of indicesToDelete) {
          deleteRequests.push({
            deleteDimension: { range: { sheetId: customersSheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 } }
          });
        }
      }

      if (deletedSales && deletedSales.length > 0 && salesSheetId !== undefined) {
        const indicesToDelete: number[] = [];
        for (let i = 1; i < existingSales.length; i++) {
          if (deletedSales.includes(existingSales[i][0])) indicesToDelete.push(i);
        }
        indicesToDelete.sort((a, b) => b - a);
        for (const idx of indicesToDelete) {
          deleteRequests.push({
            deleteDimension: { range: { sheetId: salesSheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 } }
          });
        }
      }

      if (deleteRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: deleteRequests } });
      }
    }

    // ── 6. Pull Phase (Formatting existing for return) ───────────────────────
    // We already fetched existing above, we can just parse it minus the deleted ones.
    // However, since we might have just updated/appended some rows from the push,
    // the local client already has these changes. We only return the base data minus deletions
    // The client handles timestamp comparison.
    // If the user wants the PERFECT pull, we'd fetch again, but it's okay to parse existing.

    // Parse EyePower for Customers
    const parseCustomerEyePower = (
      reDvSph?: string, reDvCyl?: string, reDvAxis?: string, reDvVa?: string,
      reNvSph?: string, reNvCyl?: string, reNvAxis?: string, reNvVa?: string,
      leDvSph?: string, leDvCyl?: string, leDvAxis?: string, leDvVa?: string,
      leNvSph?: string, leNvCyl?: string, leNvAxis?: string, leNvVa?: string,
      lens?: string, bifocals?: string, usage?: string
    ) => {
      const right = { sph: "", cyl: "", axis: "", add: "", va: "" };
      const left = { sph: "", cyl: "", axis: "", add: "", va: "" };
      
      const hasNew = reDvSph || reDvCyl || reDvAxis || reDvVa || reNvSph || reNvCyl || reNvAxis || reNvVa || leDvSph || leDvCyl || leDvAxis || leDvVa || leNvSph || leNvCyl || leNvAxis || leNvVa;
      
      if (!hasNew) return undefined;
          
      return { 
        right, left,
        re: {
           dv: { sph: reDvSph || "", cyl: reDvCyl || "", axis: reDvAxis || "", va: reDvVa || "" },
           nv: { sph: reNvSph || "", cyl: reNvCyl || "", axis: reNvAxis || "", va: reNvVa || "" }
        },
        le: {
           dv: { sph: leDvSph || "", cyl: leDvCyl || "", axis: leDvAxis || "", va: leDvVa || "" },
           nv: { sph: leNvSph || "", cyl: leNvCyl || "", axis: leNvAxis || "", va: leNvVa || "" }
        },
        useLens: lens || "",
        bifocals: bifocals || "",
        usageOption: usage || ""
      };
    };

    const pulledCustomers = existingCustomers.slice(1).map(row => ({
      id: row[0] || "", name: row[1] || "", phone: row[2] || "", email: row[3] || "",
      eyePower: parseCustomerEyePower(
        row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13],
        row[14], row[15], row[16], row[17], row[18], row[19], row[20], row[21],
        row[22], row[23], row[24]
      ),
      createdAt: row[4] || new Date().toISOString(), updatedAt: row[5] || new Date().toISOString(),
    })).filter(c => c.id && (!deletedCustomers || !deletedCustomers.includes(c.id)));

    // Parse EyePower for Sales
    const parseSaleEyePower = (
      reDvSph?: string, reDvCyl?: string, reDvAxis?: string, reDvVa?: string,
      reNvSph?: string, reNvCyl?: string, reNvAxis?: string, reNvVa?: string,
      leDvSph?: string, leDvCyl?: string, leDvAxis?: string, leDvVa?: string,
      leNvSph?: string, leNvCyl?: string, leNvAxis?: string, leNvVa?: string,
      lens?: string, bifocals?: string, usage?: string
    ) => {
      const right = { sph: "", cyl: "", axis: "" };
      const left = { sph: "", cyl: "", axis: "" };
      
      const hasNew = reDvSph || reDvCyl || reDvAxis || reDvVa || reNvSph || reNvCyl || reNvAxis || reNvVa || leDvSph || leDvCyl || leDvAxis || leDvVa || leNvSph || leNvCyl || leNvAxis || leNvVa;
      
      if (!hasNew) return undefined;
      
      return { 
        right, left,
        re: {
           dv: { sph: reDvSph || "", cyl: reDvCyl || "", axis: reDvAxis || "", va: reDvVa || "" },
           nv: { sph: reNvSph || "", cyl: reNvCyl || "", axis: reNvAxis || "", va: reNvVa || "" }
        },
        le: {
           dv: { sph: leDvSph || "", cyl: leDvCyl || "", axis: leDvAxis || "", va: leDvVa || "" },
           nv: { sph: leNvSph || "", cyl: leNvCyl || "", axis: leNvAxis || "", va: leNvVa || "" }
        },
        useLens: lens || "",
        bifocals: bifocals || "",
        usageOption: usage || ""
      };
    };

    const parsePayments = (date: string, paymentsStr?: string) => {
      if (!paymentsStr) return [];
      return paymentsStr.split("; ").map((pStr, idx) => {
        const [method, amountStr] = pStr.split(": ₹");
        return {
          id: `payment-imported-${Date.now()}-${idx}`,
          method: method || "Unknown",
          amount: parseFloat(amountStr) || 0,
          date: date,
        };
      });
    };

    const pulledSales = existingSales.slice(1).map(row => ({
      id: row[0] || "", customerId: row[1] || "", customerName: row[2] || "",
      customerPhone: row[3] || "", date: row[4] || new Date().toISOString(),
      totalAmount: parseFloat(row[5]) || 0, advancePaid: parseFloat(row[6]) || 0,
      balance: parseFloat(row[7]) || 0, status: row[8] || "Pending",
      payments: parsePayments(row[4], row[9]), notes: row[10] || "",
      eyePower: parseSaleEyePower(
        row[12], row[13], row[14], row[15], row[16], row[17],
        row[18], row[19], row[20], row[21], row[22], row[23], row[24], row[25],
        row[26], row[27], row[28], row[29], row[30]
      ),
      updatedAt: row[11] || new Date().toISOString(), synced: true,
    })).filter(s => s.id && (!deletedSales || !deletedSales.includes(s.id)));

    const hasIncomingCustomerChanges = Array.isArray(customers) && customers.length > 0;
    const hasIncomingSaleChanges = Array.isArray(sales) && sales.length > 0;
    const hasPushedChanges =
      hasIncomingCustomerChanges ||
      hasIncomingSaleChanges ||
      needsDeletion;

    if (hasPushedChanges) {
      if (
        process.env.PUSHER_APP_ID &&
        process.env.NEXT_PUBLIC_PUSHER_KEY &&
        process.env.PUSHER_SECRET &&
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER
      ) {
        try {
          const pusher = new Pusher({
            appId: process.env.PUSHER_APP_ID,
            key: process.env.NEXT_PUBLIC_PUSHER_KEY,
            secret: process.env.PUSHER_SECRET,
            cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
            useTLS: true,
          });
          await pusher.trigger("shreebilling", "sync-updated", { timestamp: Date.now() });
        } catch (e) {
          console.error("Pusher trigger failed:", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced: { customers: customers?.length ?? 0, sales: sales?.length ?? 0 },
      pulledCustomers,
      pulledSales,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    const msg = error?.cause?.message || error?.message || String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
