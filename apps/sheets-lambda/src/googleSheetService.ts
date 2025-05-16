// filepath: /Users/alex/projects/aws/bills/src/googleSheetService.ts
import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { sheets_v4 } from 'googleapis/build/src/apis/sheets'

/**
 * Authenticate with Google Sheets API using service account credentials.
 *
 * @param {string} credentialsPath - Path to the service account credentials JSON file.
 * @returns {Promise<JWT>} - Authenticated JWT client.
 */
export const authenticateGoogleSheets = async (client_email: string, private_key: string): Promise<JWT> => {
  const auth = new google.auth.JWT(client_email, undefined, private_key, [
    'https://www.googleapis.com/auth/spreadsheets',
  ])
  await auth.authorize()
  return auth
}

/**
 * Save expenses to Google Sheets.
 *
 * @param {JWT} auth - Authenticated JWT client.
 * @param {string} spreadsheetId - ID of the Google Sheets spreadsheet.
 * @param {string} range - Range in the spreadsheet to insert data.
 * @param {any[][]} values - Data to be inserted.
 * @returns {Promise<sheets_v4.Schema$AppendValuesResponse>} - Response from the Sheets API.
 */
export const saveExpensesToSheet = async (
  auth: JWT,
  spreadsheetId: string,
  range: string,
  values: any[][],
): Promise<sheets_v4.Schema$AppendValuesResponse> => {
  // Remove single quote from date string
  values.forEach((row) => {
    row[5] = row[5].replace(/^'/, '')
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const request = {
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values,
    },
  }
  const response = await sheets.spreadsheets.values.append(request)
  return response.data
}
