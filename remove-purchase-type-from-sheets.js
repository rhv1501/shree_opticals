/**
 * Google Sheets Cleanup Script - Remove "Purchase Type" Column
 *
 * This script removes the "Purchase Type" column from the Google Sheets that were
 * previously synced with the app. Run this ONCE after deploying the code changes.
 *
 * Setup:
 * 1. Install dependencies: npm install googleapis
 * 2. Set environment variables in your .env file:
 *    - GOOGLE_CLIENT_EMAIL
 *    - GOOGLE_PRIVATE_KEY (with \n properly escaped)
 *    - GOOGLE_SHEET_ID
 * 3. Run: node remove-purchase-type-from-sheets.js
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// Read from .env.local directly
const envPath = path.join(__dirname, ".env.local");
if (!fs.existsSync(envPath)) {
  require("dotenv").config();
} else {
  require("dotenv").config({ path: envPath });
}

async function removeColumn() {
  try {
    if (
      !process.env.GOOGLE_CLIENT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      console.error("❌ Missing environment variables. Please set:");
      console.error("   - GOOGLE_CLIENT_EMAIL");
      console.error("   - GOOGLE_PRIVATE_KEY (with \\n properly escaped)");
      console.error("   - GOOGLE_SHEET_ID");
      process.exit(1);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(
          /\\n/g,
          "\n",
        ).replace(/^["']|["']$/g, ""),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    console.log("📋 Fetching current sheet structure...");

    // Get sheet IDs
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    const salesSheet = metaRes.data.sheets.find(
      (s) => s.properties.title === "Sales",
    );

    if (!salesSheet) {
      console.error("❌ Sales sheet not found");
      process.exit(1);
    }

    const salesSheetId = salesSheet.properties.sheetId;
    console.log(`✓ Found Sales sheet (ID: ${salesSheetId})`);

    // Get current data
    console.log("📥 Reading current Sales data...");
    const salesData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sales!A:AZ",
    });

    const values = salesData.data.values || [];
    if (values.length === 0) {
      console.log("ℹ️  Sales sheet is empty. Nothing to clean up.");
      process.exit(0);
    }

    // Verify header structure
    const headers = values[0];
    const purchaseTypeIndex = headers.indexOf("Purchase Type");

    if (purchaseTypeIndex === -1) {
      console.log("✓ Purchase Type column already removed or not present.");
      process.exit(0);
    }

    console.log(`✓ Found "Purchase Type" at column index ${purchaseTypeIndex}`);

    // Remove the column from all rows
    console.log("🔄 Removing column from all rows...");
    const newValues = values.map((row) => {
      if (!Array.isArray(row)) return row;
      return [
        ...row.slice(0, purchaseTypeIndex),
        ...row.slice(purchaseTypeIndex + 1),
      ];
    });

    console.log(`✓ Removed column from ${newValues.length} rows`);

    // Clear the entire sheet first by deleting all data
    console.log("🗑️  Clearing Sales sheet...");
    const range = `Sales!A1:AZ1000`;
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
    console.log("✓ Sheet cleared");

    // Write cleaned data back
    console.log("📤 Writing cleaned data back to Google Sheets...");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sales!A1",
      valueInputOption: "RAW",
      resource: {
        values: newValues,
      },
    });

    console.log(
      '✅ Successfully removed "Purchase Type" column from Google Sheets!',
    );
    console.log(`   Total rows updated: ${newValues.length}`);
    console.log(
      "   Your sync will now work correctly with the updated schema.",
    );
  } catch (error) {
    console.error("❌ Error occurred:", error.message);
    if (error.message.includes("Invalid Credentials")) {
      console.error("   Please verify your Google credentials in .env");
    }
    process.exit(1);
  }
}

// Run the cleanup
removeColumn().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
