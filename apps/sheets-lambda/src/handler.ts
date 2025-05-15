import { SQSHandler, SQSMessageAttributes } from 'aws-lambda';

export const handler: SQSHandler = async (event) => {
  console.log('📥 Mensajes recibidos de SQS:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      console.log('✅ Procesando mensaje:', body);

      // Aquí podrías enviar a Google Sheets
      // Por ahora solo mostramos los campos recibidos
    } catch (err) {
      console.error('❌ Error procesando mensaje:', err);
    }
  }
};
