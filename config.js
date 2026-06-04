// ── Robison Dashboard Config ─────────────────────────────────────────────────
// Fill in your Google OAuth Client ID after creating credentials in Google Cloud Console.
// Instructions: https://console.cloud.google.com/apis/credentials
//   1. Create a project, enable "Google Sheets API"
//   2. Create OAuth 2.0 Client ID (Web application)
//   3. Add your GitHub Pages URL to "Authorized JavaScript origins"
//   4. Paste the Client ID below

const CONFIG = {
  googleClientId: "YOUR_GOOGLE_CLIENT_ID_HERE",

  // HSA Tracker spreadsheet
  hsaSpreadsheetId: "1aU2y4D8MR47-toWDgPQtJ_kFMhlj69hA0Bw_AkEIv4g",
  hsaTotalCell: "B2",          // Cell containing the "TOTAL WITHDRAWL AVAILABLE" value
  hsaSheetName: "Sheet1",      // Tab name — update if different

  // OAuth scopes needed
  scopes: "https://www.googleapis.com/auth/spreadsheets.readonly",
};
