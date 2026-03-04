import { SESClient } from '@aws-sdk/client-ses';

export const sesClient = new SESClient({
  region: process.env['REGION'] ?? 'us-east-1',
});
