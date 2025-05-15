import { App } from 'aws-cdk-lib';
import { ReceiptStack } from './receipt-stack';

const app = new App();

new ReceiptStack(app, 'ReceiptStack');
