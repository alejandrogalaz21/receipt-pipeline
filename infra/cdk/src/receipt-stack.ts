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
