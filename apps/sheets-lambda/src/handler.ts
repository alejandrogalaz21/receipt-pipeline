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

    let parsedSNSMessage;
    try {
      const outerBody = JSON.parse(record.body);
      parsedSNSMessage = JSON.parse(outerBody.Message);
      console.log('📨 Parsed SNS Message:', parsedSNSMessage);
    } catch (error) {
      console.error('❌ Failed to parse SNS message:', error);
      continue;
    }

    try {
      const { extractedFields, bucket, key } = parsedSNSMessage;

      if (!extractedFields) {
        console.warn('⚠️ No extractedFields found in message.');
        continue;
      }

      // Create a row using values from extractedFields + metadata
      const row = [
        ...Object.values(extractedFields),
        bucket || '',
        key || ''
      ];

      console.log(`📝 Appending row to Google Sheets:`, row);
      await saveExpensesToSheet(auth, spreadsheetId, range, [row]);
      console.log('✅ Data appended to Google Sheets.');
    } catch (error) {
      console.error('❌ Error while saving data to Google Sheets:', error);
    }
  }

  return {
    statusCode: 200,
    body: 'Processed successfully',
  };
};
