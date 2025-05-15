import { S3Event, Context } from 'aws-lambda';
import { S3, Textract } from 'aws-sdk';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const s3 = new S3();
const textract = new Textract();

export const handler = async (event: S3Event, context: Context) => {
  console.log('Event recibido:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Procesando archivo S3: Bucket=${bucket}, Key=${key}`);

    try {
      // Descarga el objeto desde S3
      const s3Object = await s3.getObject({ Bucket: bucket, Key: key }).promise();
      if (!s3Object.Body) throw new Error('El objeto S3 no tiene contenido');

      // Llama a Textract para analizar recibo (expense)
      const params = {
        Document: {
          Bytes: s3Object.Body as Buffer,
        },
      };

      const textractResponse = await textract.analyzeExpense(params).promise();

      console.log('Respuesta Textract:', JSON.stringify(textractResponse, null, 2));

      // Aquí podrías extraer campos importantes, ejemplo rápido:
      const summaryFields = textractResponse.ExpenseDocuments?.[0]?.SummaryFields;

      if (summaryFields) {
        for (const field of summaryFields) {
          console.log(`Campo: ${field.Type?.Text}, Valor: ${field.ValueDetection?.Text}`);
        }
      } else {
        console.log('No se encontraron campos en el recibo');
      }

    } catch (error) {
      console.error('Error procesando el archivo:', error);
    }
  }

  return {
    statusCode: 200,
    body: 'Procesamiento completado',
  };
};
