const { google } = require('googleapis');
require('dotenv').config({ path: '/mnt/data/shreebilling/.env.local' });

const client_email = process.env.GOOGLE_CLIENT_EMAIL;
const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "");
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function run() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    const customersSheetId = metaRes.data.sheets?.find(s => s.properties?.title === "Customers")?.properties?.sheetId;
    const salesSheetId = metaRes.data.sheets?.find(s => s.properties?.title === "Sales")?.properties?.sheetId;
    
    // Customers legacy: columns 4 to 13 (inclusive). E is index 4, N is index 13.
    // Length: 10 columns. So startIndex: 4, endIndex: 14.
    
    // Sales legacy: columns 12 to 17 (inclusive). M is 12, R is 17.
    // Length: 6 columns. So startIndex: 12, endIndex: 18.
    
    console.log("Customers sheet ID:", customersSheetId);
    console.log("Sales sheet ID:", salesSheetId);
    
    const requests = [
      {
        deleteDimension: {
          range: {
            sheetId: customersSheetId,
            dimension: "COLUMNS",
            startIndex: 4,
            endIndex: 14
          }
        }
      },
      {
        deleteDimension: {
          range: {
            sheetId: salesSheetId,
            dimension: "COLUMNS",
            startIndex: 12,
            endIndex: 18
          }
        }
      }
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
    
    console.log("Deleted legacy columns in Google Sheets!");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
