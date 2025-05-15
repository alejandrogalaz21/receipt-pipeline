import { S3Event, Context } from 'aws-lambda';
import { S3, Textract } from 'aws-sdk';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const s3 = new S3();
const textract = new Textract();
const snsClient = new SNSClient({});

/**
 * Lambda handler triggered by S3 event (upload to /tickets/)
 */
export const handler = async (event: S3Event, context: Context) => {
  console.log('📦 Event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`📁 Processing S3 object: Bucket=${bucket}, Key=${key}`);

    try {
      // Get file content from S3
      const s3Object = await s3.getObject({ Bucket: bucket, Key: key }).promise();
      if (!s3Object.Body) throw new Error('El objeto S3 no tiene contenido');

      // Analyze receipt with Textract
      const textractResponse = await textract.analyzeExpense({
        Document: { Bytes: s3Object.Body as Buffer }
      }).promise();

      console.log('🧾 Textract response:', JSON.stringify(textractResponse, null, 2));

      // Extract useful summary fields
      const summaryFields = textractResponse.ExpenseDocuments?.[0]?.SummaryFields;
      const extractedFields: Record<string, string> = {};

      if (summaryFields) {
        for (const field of summaryFields) {
          const key = field.Type?.Text?.trim() || 'Unknown';
          const value = field.ValueDetection?.Text?.trim() || '';
          extractedFields[key] = value;
        }

        console.log('✅ Extracted fields:', extractedFields);
      } else {
        console.log('⚠️ No summary fields found in receipt');
      }

      // Send to SNS
      const snsTopicArn = process.env.SNS_TOPIC_ARN;
      if (!snsTopicArn) {
        throw new Error('SNS_TOPIC_ARN is not defined in the environment');
      }

      const publishCommand = new PublishCommand({
        TopicArn: snsTopicArn,
        Message: JSON.stringify({
          bucket,
          key,
          extractedFields,
        }),
        Subject: 'New Receipt Processed',
      });

      await snsClient.send(publishCommand);
      console.log('📨 Published message to SNS');

    } catch (error) {
      console.error('❌ Error processing receipt:', error);
    }
  }

  return {
    statusCode: 200,
    body: 'Procesamiento completado',
  };
};
