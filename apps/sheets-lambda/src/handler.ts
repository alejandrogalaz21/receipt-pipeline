import { SQSEvent, Context } from 'aws-lambda';
import {
  authenticateGoogleSheets,
  saveExpensesToSheet
} from './googleSheetService';

/**
 * Handle incoming messages from SheetsQueue (SNS->SQS).
 */
export const handler = async (event: SQSEvent, context: Context) => {
  console.log('📩 Received event:', JSON.stringify(event, null, 2));

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;
  const range = process.env.GOOGLE_SPREADSHEET_RANGE || 'Tickets!A1';

  let auth;

  try {
    console.log('🔐 Authenticating with Google Sheets...');
    auth = await authenticateGoogleSheets(clientEmail, privateKey);
    console.log('✅ Authenticated with Google Sheets.');
  } catch (error) {
    console.error('❌ Failed to authenticate with Google Sheets:', error);
    return {
      statusCode: 500,
      body: 'Authentication failed',
    };
  }

  for (const record of event.Records) {
    console.log('📦 Processing SQS record...');

    let body;
    try {
      body = JSON.parse(record.body);
      console.log('📨 Message body parsed:', body);
    } catch (error) {
      console.error('❌ Failed to parse SQS message body:', error);
      continue;
    }

    try {
      const fields = body.ExpenseDocuments?.[0]?.SummaryFields || [];
      const row: any[] = fields.map((field: any) => field.ValueDetection?.Text || '');

      if (row.length > 0) {
        console.log(`📝 Appending row to Google Sheets:`, row);
        await saveExpensesToSheet(auth, spreadsheetId, range, [row]);
        console.log('✅ Data appended to Google Sheets.');
      } else {
        console.warn('⚠️ No summary fields found in message.');
      }
    } catch (error) {
      console.error('❌ Error while saving data to Google Sheets:', error);
    }
  }

  return {
    statusCode: 200,
    body: 'Processed successfully',
  };
};
