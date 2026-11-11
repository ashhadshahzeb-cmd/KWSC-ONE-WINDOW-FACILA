import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Configuration & Defaults
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CREDS_PATH = path.resolve(__dirname, 'google-service-account.json');
let cachedSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || null;
let sheetsClient = null;
let driveClient = null;

export const SHEET_HEADERS = [
  'Timestamp (PKT)',
  'CFO Diary No',
  'Receiving No',
  'Tracking ID',
  'Employee No',
  'Subject',
  'Main Category',
  'Sub Category',
  'Received From / Party Name',
  'Current Section (Mark To)',
  'Net Amount (PKR)',
  'Inward Date',
  'Status',
  'Remarks',
  'Record ID',
  'File Owner / Handover Person',
  'File Purpose / Description',
  'Registration Date',
  'Print Date',
  'Additional Mark To',
  'Gross Amount (PKR)',
  'Deduction (PKR)',
  'Budget Code',
  'Voucher Code',
  'Vehicle No',
  'Department No',
  'Fuel Station',
  'Date of Sign',
  'Outward Date',
  'Subject Prefix'
];

/**
 * Format date in Pakistan Standard Time (PKT)
 */
function getPktDateTime(dateVal = null) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Convert a file_tracking_records row into a complete Google Sheets 30-column row array
 */
export function recordToSheetRow(record) {
  return [
    getPktDateTime(record.created_at || record.inward_date),
    record.cfo_diary_number || '',
    record.receiving_number || '',
    record.tracking_id || '',
    record.employee_number || '',
    record.subject || '',
    record.main_category || '',
    record.sub_category || '',
    record.received_from || record.party_name || '',
    record.mark_to || '',
    record.amount ? Number(record.amount) : '',
    record.inward_date || '',
    record.outward_date ? `Outwarded (${record.outward_date})` : (record.status || 'Active'),
    record.remarks || '',
    record.id || '',
    record.handover_person_name || '',
    record.file_purpose || '',
    record.created_at || record.registration_date || '',
    record.print_date || '',
    record.additional_mark_to || '',
    record.gross_amount ? Number(record.gross_amount) : '',
    record.deduction ? Number(record.deduction) : '',
    record.budget_code || '',
    record.voucher_code || '',
    record.vehicle_no || '',
    record.department_number || '',
    record.fuel_station || '',
    record.date_of_sign || '',
    record.outward_date || '',
    record.subject_prefix || ''
  ];
}

/**
 * Initialize Google Sheets & Drive API Clients using Service Account JSON
 */
export function initGoogleAuth() {
  const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || DEFAULT_CREDS_PATH;

  if (!fs.existsSync(credsPath)) {
    return {
      success: false,
      error: `Service account credentials not found at: ${credsPath}`
    };
  }

  try {
    const credsRaw = fs.readFileSync(credsPath, 'utf8');
    const credentials = JSON.parse(credsRaw);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    driveClient = google.drive({ version: 'v3', auth });

    return { success: true, clientEmail: credentials.client_email, auth };
  } catch (err) {
    console.error('❌ Failed to initialize Google Auth:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Append a newly registered file record to Google Sheets
 */
export async function appendRecordToGoogleSheet(record, customSpreadsheetId = null) {
  const spreadsheetId = customSpreadsheetId || cachedSpreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;

  // Webhook fallback (Alternative: Google Apps Script Webhook)
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (webhookUrl && !spreadsheetId && !fs.existsSync(DEFAULT_CREDS_PATH)) {
    try {
      const rowData = recordToSheetRow(record);
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INSERT', record, row: rowData })
      });
      return { success: true, method: 'webhook' };
    } catch (whErr) {
      console.warn('⚠️ Webhook sync failed:', whErr.message);
    }
  }

  if (!sheetsClient) {
    const authRes = initGoogleAuth();
    if (!authRes.success) {
      return { success: false, error: authRes.error };
    }
  }

  if (!spreadsheetId) {
    return {
      success: false,
      error: 'No GOOGLE_SPREADSHEET_ID set.'
    };
  }

  try {
    const rowValues = recordToSheetRow(record);

    const response = await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `Sheet1!A:AD`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowValues]
      }
    });

    return { success: true, updatedRange: response.data.updates?.updatedRange };
  } catch (err) {
    console.error('❌ Error appending to Google Sheet:', err.message);
    return { success: false, error: err.message };
  }
}
