const { google } = require('googleapis');
// Next.js uses standard process.env, let's use dotenv or load it simply without regex mess
require('dotenv').config({ path: '/mnt/data/shreebilling/.env.local' });

const client_email = process.env.GOOGLE_CLIENT_EMAIL;
// Fix quotes and newlines exactly like the app does in route.ts
const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function run() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Customers!A1:AZ5',
    });
    
    console.log("=== Customers Sheet (Top 5 Rows) ===");
    const rows = res.data.values;
    if (rows && rows.length) {
      rows.forEach((row, ix) => {
        console.log(`Row ${ix + 1}:`, row);
      });
    } else {
      console.log('No data found.');
    }
  } catch (e) {
    console.error("Error fetching data:", e.message);
  }
}

run();
