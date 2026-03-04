import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient(
  process.env['IS_OFFLINE'] === 'true'
    ? {
        region: 'localhost',
        endpoint: process.env['DYNAMODB_ENDPOINT'] ?? 'http://localhost:8000',
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }
    : {
        region: process.env['REGION'] ?? 'us-east-1',
      },
);

export const dynamodb = DynamoDBDocumentClient.from(client);
