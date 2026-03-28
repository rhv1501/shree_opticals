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
    const customersRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Customers!A:AZ' });
    const salesRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sales!A:AZ' });
    
    const customers = customersRes.data.values || [];
    const sales = salesRes.data.values || [];
    
    for (let i = 1; i < customers.length; i++) {
        let created = customers[i][4];
        let updated = customers[i][5];
        if (created && isNaN(new Date(created).getTime())) {
            console.log(`Customer Row ${i+1} INVALID createdAt: "${created}"`);
        }
        if (updated && isNaN(new Date(updated).getTime())) {
            console.log(`Customer Row ${i+1} INVALID updatedAt: "${updated}"`);
        }
    }

    for (let i = 1; i < sales.length; i++) {
        let date = sales[i][4];
        let updated = sales[i][12];
        if (date && isNaN(new Date(date).getTime())) {
            console.log(`Sales Row ${i+1} INVALID date: "${date}"`);
        }
        if (updated && isNaN(new Date(updated).getTime())) {
            console.log(`Sales Row ${i+1} INVALID updatedAt: "${updated}"`);
        }
    }
    console.log("Check complete.");
    
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
