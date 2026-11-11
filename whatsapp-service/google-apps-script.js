// =====================================================================
// KWSC File Tracking - Google Apps Script (Auto Append & Update Rows)
// All 30 Fields with Real Authentic Column Names
// =====================================================================

var ALL_HEADERS = [
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

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'KWSC File Tracking Webhook',
    total_fields: ALL_HEADERS.length
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure Header Row 1 has all 30 columns
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(ALL_HEADERS);
      sheet.getRange(1, 1, 1, ALL_HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#0f172a')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    } else {
      var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), ALL_HEADERS.length)).getValues()[0];
      if (currentHeaders[1] === 'Timestamp (PKT)' || currentHeaders.length < ALL_HEADERS.length) {
        sheet.getRange(1, 1, 1, ALL_HEADERS.length).setValues([ALL_HEADERS]);
      }
    }
    
    var rec = data.record || {};
    
    // Construct complete 30-column row
    var row = data.row || [
      data.timestamp || new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
      rec.cfo_diary_number || '',
      rec.receiving_number || '',
      rec.tracking_id || '',
      rec.employee_number || '',
      rec.subject || '',
      rec.main_category || rec.mainCategory || '',
      rec.sub_category || rec.subCategory || '',
      rec.received_from || rec.party_name || '',
      rec.mark_to || '',
      rec.amount || '',
      rec.inward_date || '',
      rec.status || 'Active',
      rec.remarks || '',
      rec.id || '',
      rec.handover_person_name || '',
      rec.file_purpose || '',
      rec.created_at || rec.registration_date || '',
      rec.print_date || '',
      rec.additional_mark_to || '',
      rec.gross_amount || '',
      rec.deduction || '',
      rec.budget_code || '',
      rec.voucher_code || '',
      rec.vehicle_no || '',
      rec.department_number || '',
      rec.fuel_station || '',
      rec.date_of_sign || '',
      rec.outward_date || '',
      rec.subject_prefix || ''
    ];
    
    // If updating an existing record, update the existing row in-place
    if (data.action === 'UPDATE' && (rec.id || rec.receiving_number)) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 15, lastRow - 1, 1).getValues(); // Column O (Record ID)
        for (var i = ids.length - 1; i >= 0; i--) {
          if (rec.id && ids[i][0] && ids[i][0].toString().trim() === rec.id.toString().trim()) {
            sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', action: 'updated', row: i + 2 }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
    }
    
    // Otherwise append new row
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', action: 'inserted', total_columns: row.length }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
