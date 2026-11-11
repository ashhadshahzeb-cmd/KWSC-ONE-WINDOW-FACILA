/**
 * Direct Frontend -> Google Sheets Sync Client
 * Sends newly created/updated file entries directly to Google Sheets via Apps Script Webhook.
 * Sends ALL 30 fields with their real, authentic names.
 */

const DEFAULT_WEBHOOK_URL = import.meta.env.VITE_GOOGLE_SHEET_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxW0yBwsLJvm10uw0PdSApxqxRptHcCoXUy7eQXbZQFYeKw4AfAbBeyaMptPRY7q9em/exec';

export const ALL_SHEET_HEADERS = [
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

export async function syncToGoogleSheetDirectly(record: any): Promise<boolean> {
  const webhookUrl = import.meta.env.VITE_GOOGLE_SHEET_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;

  if (!webhookUrl) {
    return false;
  }

  try {
    const timestampPkt = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
    
    // Complete 30-column row matching header order exactly
    const row = [
      timestampPkt,                                                      // Col A: Timestamp (PKT)
      record.cfo_diary_number || '',                                     // Col B: CFO Diary No
      record.receiving_number || '',                                     // Col C: Receiving No
      record.tracking_id || '',                                          // Col D: Tracking ID
      record.employee_number || '',                                      // Col E: Employee No
      record.subject || '',                                              // Col F: Subject
      record.main_category || record.mainCategory || '',                 // Col G: Main Category
      record.sub_category || record.subCategory || '',                   // Col H: Sub Category
      record.received_from || record.party_name || '',                   // Col I: Received From / Party Name
      record.mark_to || '',                                              // Col J: Current Section (Mark To)
      record.amount !== undefined && record.amount !== null && record.amount !== '' ? Number(record.amount) : '', // Col K: Net Amount (PKR)
      record.inward_date || '',                                          // Col L: Inward Date
      record.outward_date ? `Outwarded (${record.outward_date})` : (record.status || 'Active'),                   // Col M: Status
      record.remarks || '',                                              // Col N: Remarks
      record.id || '',                                                   // Col O: Record ID
      record.handover_person_name || '',                                 // Col P: File Owner / Handover Person
      record.file_purpose || '',                                         // Col Q: File Purpose / Description
      record.created_at || record.registration_date || '',               // Col R: Registration Date
      record.print_date || '',                                           // Col S: Print Date
      record.additional_mark_to || '',                                   // Col T: Additional Mark To
      record.gross_amount ? Number(record.gross_amount) : '',            // Col U: Gross Amount (PKR)
      record.deduction ? Number(record.deduction) : '',                  // Col V: Deduction (PKR)
      record.budget_code || '',                                          // Col W: Budget Code
      record.voucher_code || '',                                         // Col X: Voucher Code
      record.vehicle_no || '',                                           // Col Y: Vehicle No
      record.department_number || '',                                    // Col Z: Department No
      record.fuel_station || '',                                         // Col AA: Fuel Station
      record.date_of_sign || '',                                         // Col AB: Date of Sign
      record.outward_date || '',                                         // Col AC: Outward Date
      record.subject_prefix || ''                                        // Col AD: Subject Prefix
    ];

    const payload = {
      action: 'INSERT',
      timestamp: new Date().toISOString(),
      row: row,
      record: {
        timestamp_pkt: timestampPkt,
        cfo_diary_number: record.cfo_diary_number || '',
        receiving_number: record.receiving_number || '',
        tracking_id: record.tracking_id || '',
        employee_number: record.employee_number || '',
        subject: record.subject || '',
        main_category: record.main_category || record.mainCategory || '',
        sub_category: record.sub_category || record.subCategory || '',
        received_from: record.received_from || record.party_name || '',
        mark_to: record.mark_to || '',
        amount: record.amount ? Number(record.amount) : '',
        inward_date: record.inward_date || '',
        status: record.outward_date ? `Outwarded (${record.outward_date})` : (record.status || 'Active'),
        remarks: record.remarks || '',
        id: record.id || '',
        handover_person_name: record.handover_person_name || '',
        file_purpose: record.file_purpose || '',
        registration_date: record.created_at || record.registration_date || '',
        print_date: record.print_date || '',
        additional_mark_to: record.additional_mark_to || '',
        gross_amount: record.gross_amount ? Number(record.gross_amount) : '',
        deduction: record.deduction ? Number(record.deduction) : '',
        budget_code: record.budget_code || '',
        voucher_code: record.voucher_code || '',
        vehicle_no: record.vehicle_no || '',
        department_number: record.department_number || '',
        fuel_station: record.fuel_station || '',
        date_of_sign: record.date_of_sign || '',
        outward_date: record.outward_date || '',
        subject_prefix: record.subject_prefix || ''
      }
    };

    // Use mode: 'no-cors' so browser security never blocks Google Apps Script redirect
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (err) {
    console.warn('[GoogleSheets Direct] Sync warning:', err);
    return false;
  }
}
