const { google } = require('googleapis');
require('dotenv').config({ path: '/mnt/data/shreebilling/.env.local' });

const client_email = process.env.GOOGLE_CLIENT_EMAIL;
const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

const CUSTOMER_HEADERS = [
  "Customer ID", "Name", "Phone", "Email",
  "Right SPH", "Right CYL", "Right AXIS", "Right ADD", "Right VA",
  "Left SPH", "Left CYL", "Left AXIS", "Left ADD", "Left VA",
  "Created At", "Updated At",
  "RE DV SPH", "RE DV CYL", "RE DV AXIS", "RE DV VA",
  "RE NV SPH", "RE NV CYL", "RE NV AXIS", "RE NV VA",
  "LE DV SPH", "LE DV CYL", "LE DV AXIS", "LE DV VA",
  "LE NV SPH", "LE NV CYL", "LE NV AXIS", "LE NV VA",
  "Lens", "Bifocals", "Usage Option"
];

const SALES_HEADERS = [
  "Sale ID", "Customer ID", "Customer Name", "Phone", "Date", "Purchase Type",
  "Total Amount", "Advance Paid", "Balance", "Status", "Payment Methods", "Notes",
  "Right SPH", "Right CYL", "Right AXIS", "Left SPH", "Left CYL", "Left AXIS",
  "Updated At",
  "RE DV SPH", "RE DV CYL", "RE DV AXIS", "RE DV VA",
  "RE NV SPH", "RE NV CYL", "RE NV AXIS", "RE NV VA",
  "LE DV SPH", "LE DV CYL", "LE DV AXIS", "LE DV VA",
  "LE NV SPH", "LE NV CYL", "LE NV AXIS", "LE NV VA",
  "Lens", "Bifocals", "Usage Option"
];

async function run() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    console.log("Applying headers to Google Sheets...");
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: "Customers!A1:AI1",
            values: [CUSTOMER_HEADERS]
          },
          {
            range: "Sales!A1:AL1",
            values: [SALES_HEADERS]
          }
        ],
      },
    });
    console.log("Headers successfully applied! Fetching row 1 to verify...");
    
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Customers!A1:AZ2',
    });
    console.log("Row 1 now is:", res.data.values[0]);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
