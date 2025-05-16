import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

import * as path from 'path';

export class ReceiptStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Crear bucket S3 para los tickets
    const bucket = new s3.Bucket(this, 'TicketsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // SNS Topic
    const receiptTopic = new sns.Topic(this, 'ReceiptTopic');

    // SQS queues para fan-out

    // SQS Google Sheets Lambda
    const sheetsQueue = new sqs.Queue(this, 'SheetsQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // SQS DynamoDB
    const dynamoQueue = new sqs.Queue(this, 'DynamoDBQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Suscribir las SQS al SNS topic
    receiptTopic.addSubscription(new subscriptions.SqsSubscription(sheetsQueue));
    receiptTopic.addSubscription(new subscriptions.SqsSubscription(dynamoQueue));

    // Lambda Textract
    const textractLambda = new NodejsFunction(this, 'TextractReceiptLambda', {
      entry: path.join(__dirname, '../../../apps/textract-receipt-lambda/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        SNS_TOPIC_ARN: receiptTopic.topicArn,
      },
    });

    // Permisos
    bucket.grantRead(textractLambda);
    receiptTopic.grantPublish(textractLambda);

    // Agregar permisos para Textract
    textractLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['textract:AnalyzeExpense'],
        resources: ['*'],
        effect: Effect.ALLOW,
      })
    );

    // Nueva lambda que procesará los datos desde SheetsQueue
    const sheetsLambda = new NodejsFunction(this, 'SheetsLambda', {
      entry: path.join(__dirname, '../../../apps/sheets-lambda/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        GOOGLE_SPREADSHEET_ID: "1N950b-s9nd-GS1LBS3JzXQS86TGjAYypRPwDfAsET1k",
        GOOGLE_CLIENT_EMAIL: "google-sheets@the-art-of-coding.iam.gserviceaccount.com",
        GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCRfY5gBGHumXVX\n/1VqVPHxYjjKnNhTsscLWdFK7NJMo6Fq9q279+io5YBah5k34oN6SGxIo4e8ivrC\nEveRtvJVCg2KrgVMC8V/2LfSeAJu+woFe6FAaIg+JJH3NELDCzEwYX+UOQqX/q2F\nyAYdMI8n92NBvd1Uy8rcrkcuIx3vnpJ7RT7ormorNSNz+/Lpk9hHu9kIPOsGNl9y\nupXCQolyJ5khdcDlZLXXf8cQ0IuV2J6Y49E4u3FFV2UpIeSDcxBEd1ITBE7HrqAW\n/eDuchguLDDCKScIM1R4cPk8WSwCYn4R4EOE5/Utd0hQgZGwgo797YB08wjxzRL8\nCGwjN8s9AgMBAAECggEAAXO5bcu6vCejxEImtKtj3cb0mPsUl/iXDs3cQ6KWR7sI\nrk6yIF039nrnO3Vn1KcKAmNXfKhwf0kmJF/i631MsQdrEq5WxwdFYZevX/ugJJeU\npkYxWg6hBiPAdtvlQFlBKgHdxNmGjvVKVI/mQGN+w5qZuZXURWzM7xkTL0qc7spd\nwt8uUJumOsRfinYxemKtNANYi/vMzYpccKKdynXOgpdjgLbRfpnbQ/RTEtR90eh7\ncjdgqB2aavY2lCNQl4iGla69MlR6Vv6iDN9GXuSpeGJnP+Mh93cDJpWvZ3XGxo0G\nXhC+BDmPf1kWb2uvbet0Ob4v3gfFAWLIsE4kPDqZQQKBgQDBUIAWvglazmIXtH2N\nxydQiuVSQqc99QMN4nCNdRwIjQhTMmu2YWrL8YwJkmvpXjV1AL64D/rAsvs2N6up\n6CDAV5h8feK5bdN9e7+3UsVNhFsO7c5n9R/jAS+soxHL4QG3h2kM+k04i0TRlGkZ\n8+CGPLHa9vnc3dNbUtDlOEQaQQKBgQDAqxHtHfim9ci3d/lQdT1dr+crar6xNOIM\nUnXlkYHWvyHHxNbiIue72pERKFPgMZVCkL6zyuGNnW5E6056dlrHWO4D5v5KxRL8\n90mMVcRUDgdq1wrc2NUq2QDKNbsA5SZcPm2oQJogxEeeS1QuLh2fhmViSLlDoYMI\nWYnEi/mZ/QKBgEtaX7N9vBPDYwUue8pqGO8SVTVteddyzA/7djgNsDG9F8OmYcoj\nywdYTmfkxV+gM2I6Oh1xTSMUIUwPA0EllK6k9nGAeIIjR08gj6icAQCoWP5GwDBR\nom5QJg87OVKpkIvDorVGVBd4Ygj3usg9AgYRXpqlrtvjM+HjND5FYnaBAoGBAIWc\nHKpbBnyCJddVk8eABjZaLe2l8OfizH/PD4NMDMZndX2bu4jGu/1B7SgA12m5+NBY\noGb+YrxaWIXiyGGUgg+MVELQhbhEQo66zn5LXAMOV4Z36kiM9gboxet0p2JPhvKh\nOFpdsoTWmPPlOVNtF43xHY2y8Qc9kijQLwHmMAnhAoGAVMLuG0Pr58rp2gW3J30c\nITJhBy9kJgfBhm7CpOmUx/trek1B6xmv1P+7wPTU1NkcByaqmn1vuyf5+jAtYif0\njHlRehZEDB2fkWeJ4MTK49QtXuogzj+GQMIW9sbz9jgr0ZI6Z4FbAKONid/p220x\nssVh9qJdOPvjTBtE2+zT2w0=\n-----END PRIVATE KEY-----\n",
        GOOGLE_SPREADSHEET_RANGE: 'Tickets!A1',
      },
    });

    // Dar permisos para que la lambda lea de la cola
    sheetsQueue.grantConsumeMessages(sheetsLambda);

    // Conectar la cola como fuente de eventos a la lambda
    sheetsLambda.addEventSource(new lambdaEventSources.SqsEventSource(sheetsQueue));

    // Evento para disparar Lambda al subir archivos a S3 (solo en carpeta tickets/)
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractLambda),
      { prefix: 'tickets/' }
    );
  }
}
