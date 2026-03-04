import { SQSClient } from '@aws-sdk/client-sqs';

export const sqsClient = new SQSClient(
  process.env['IS_OFFLINE'] === 'true'
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:9324',
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }
    : {
        region: process.env['REGION'] ?? 'us-east-1',
      },
);
