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
    
    // Customers legacy indices: 4 to 13
    let customersLegacyEmpty = true;
    for (let i = 1; i < customers.length; i++) { // skip header
      const row = customers[i];
      for (let j = 4; j <= 13; j++) {
        if (row[j] && row[j].trim() !== '') {
          customersLegacyEmpty = false;
          console.log(`Found data in Customers row ${i + 1}, col index ${j}: "${row[j]}"`);
          break;
        }
      }
      if (!customersLegacyEmpty) break;
    }
    
    console.log("Customers legacy 10 columns are completely empty:", customersLegacyEmpty);
    
    // Sales legacy indices: 12 to 17
    let salesLegacyEmpty = true;
    for (let i = 1; i < sales.length; i++) {
      const row = sales[i];
      for (let j = 12; j <= 17; j++) {
        if (row[j] && row[j].trim() !== '') {
          salesLegacyEmpty = false;
          console.log(`Found data in Sales row ${i + 1}, col index ${j}: "${row[j]}"`);
          break;
        }
      }
      if (!salesLegacyEmpty) break;
    }
    
    console.log("Sales legacy 6 columns are completely empty:", salesLegacyEmpty);
    
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
