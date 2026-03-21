import { google } from "googleapis";
import { NextResponse } from "next/server";

const CUSTOMER_HEADERS = [
  "Customer ID", "Name", "Phone", "Email",
  "Right SPH", "Right CYL", "Right AXIS", "Right ADD", "Right VA",
  "Left SPH", "Left CYL", "Left AXIS", "Left ADD", "Left VA",
  "Created At", "Updated At",
];

const SALES_HEADERS = [
  "Sale ID", "Customer ID", "Customer Name", "Phone", "Date", "Purchase Type",
  "Total Amount", "Advance Paid", "Balance", "Status", "Payment Methods", "Notes",
  "Right SPH", "Right CYL", "Right AXIS", "Left SPH", "Left CYL", "Left AXIS",
  "Updated At",
];

export async function POST(request: Request) {
  try {
    const { customers, sales } = await request.json();

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
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Helper: get current row count of a sheet
    const getRowCount = async (sheetName: string) => {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      });
      return res.data.values?.length ?? 0;
    };

    // Helper: append rows (with optional header if sheet is empty)
    const appendRows = async (sheetName: string, headers: string[], rows: unknown[][]) => {
      if (rows.length === 0) return;
      const currentRows = await getRowCount(sheetName);
      const rowsToWrite = currentRows === 0 ? [headers, ...rows] : rows;
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rowsToWrite },
      });
    };

    // ── Customers sheet ──────────────────────────────────────────────────────
    if (customers && customers.length > 0) {
      const rows = customers.map((c: any) => [
        c.id,
        c.name,
        c.phone || "",
        c.email || "",
        c.eyePower?.right?.sph  || "",
        c.eyePower?.right?.cyl  || "",
        c.eyePower?.right?.axis || "",
        c.eyePower?.right?.add  || "",
        c.eyePower?.right?.va   || "",
        c.eyePower?.left?.sph   || "",
        c.eyePower?.left?.cyl   || "",
        c.eyePower?.left?.axis  || "",
        c.eyePower?.left?.add   || "",
        c.eyePower?.left?.va    || "",
        c.createdAt,
        c.updatedAt,
      ]);
      await appendRows("Customers", CUSTOMER_HEADERS, rows);
    }

    // ── Sales sheet ──────────────────────────────────────────────────────────
    if (sales && sales.length > 0) {
      const rows = sales.map((s: any) => [
        s.id,
        s.customerId,
        s.customerName,
        s.customerPhone || "",
        s.date,
        s.purchaseType?.join(", ") || "",
        s.totalAmount,
        s.advancePaid,
        s.balance,
        s.status,
        s.payments?.map((p: any) => `${p.method}: ₹${p.amount}`).join("; ") || "",
        s.notes || "",
        s.eyePower?.right?.sph  || "",
        s.eyePower?.right?.cyl  || "",
        s.eyePower?.right?.axis || "",
        s.eyePower?.left?.sph   || "",
        s.eyePower?.left?.cyl   || "",
        s.eyePower?.left?.axis  || "",
        s.updatedAt,
      ]);
      await appendRows("Sales", SALES_HEADERS, rows);
    }

    // ── Pull phase ────────────────────────────────────────────────────────
    // Fetch all current data from Customers and Sales to support two-way sync
    const [customersRes, salesRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Customers!A:P", // 16 columns
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sales!A:S", // 19 columns
      }),
    ]);

    // Parse EyePower for Customers
    const parseCustomerEyePower = (
      rSph?: string, rCyl?: string, rAxis?: string, rAdd?: string, rVa?: string,
      lSph?: string, lCyl?: string, lAxis?: string, lAdd?: string, lVa?: string
    ) => {
      const right = { sph: rSph || "", cyl: rCyl || "", axis: rAxis || "", add: rAdd || "", va: rVa || "" };
      const left = { sph: lSph || "", cyl: lCyl || "", axis: lAxis || "", add: lAdd || "", va: lVa || "" };
      const isEmpty = (ep: any) => !ep.sph && !ep.cyl && !ep.axis && !ep.add && !ep.va;
      if (isEmpty(right) && isEmpty(left)) return undefined;
      return { right, left };
    };

    const pulledCustomers = (customersRes.data.values || []).slice(1).map(row => ({
      id: row[0] || "",
      name: row[1] || "",
      phone: row[2] || "",
      email: row[3] || "",
      eyePower: parseCustomerEyePower(row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13]),
      createdAt: row[14] || new Date().toISOString(),
      updatedAt: row[15] || new Date().toISOString(),
    })).filter(c => c.id); // Valid IDs only

    // Parse EyePower for Sales
    const parseSaleEyePower = (
      rSph?: string, rCyl?: string, rAxis?: string,
      lSph?: string, lCyl?: string, lAxis?: string
    ) => {
      const right = { sph: rSph || "", cyl: rCyl || "", axis: rAxis || "" };
      const left = { sph: lSph || "", cyl: lCyl || "", axis: lAxis || "" };
      const isEmpty = (ep: any) => !ep.sph && !ep.cyl && !ep.axis;
      if (isEmpty(right) && isEmpty(left)) return undefined;
      return { right, left };
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

    const pulledSales = (salesRes.data.values || []).slice(1).map(row => ({
      id: row[0] || "",
      customerId: row[1] || "",
      customerName: row[2] || "",
      customerPhone: row[3] || "",
      date: row[4] || new Date().toISOString(),
      purchaseType: row[5] ? row[5].split(", ") : [],
      totalAmount: parseFloat(row[6]) || 0,
      advancePaid: parseFloat(row[7]) || 0,
      balance: parseFloat(row[8]) || 0,
      status: row[9] || "Pending",
      payments: parsePayments(row[4], row[10]),
      notes: row[11] || "",
      eyePower: parseSaleEyePower(row[12], row[13], row[14], row[15], row[16], row[17]),
      updatedAt: row[18] || new Date().toISOString(),
      synced: true,
    })).filter(s => s.id); // Valid IDs only

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
