import fs from 'fs';
import path from 'path';
import type { SQSHandler } from 'aws-lambda';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { sesClient } from '../../infrastructure/aws/sesClient';

interface SqsMessageData {
  id: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  message: string;
  timestamp: number;
}

interface SqsMessageBody {
  type: string;
  data: SqsMessageData;
}

export const handler: SQSHandler = async (event): Promise<void> => {
  const record = event.Records[0];
  const payload = JSON.parse(record.body) as SqsMessageBody;
  const { data } = payload;

  const templatePath = path.join(__dirname, '../templates/emailTemplate.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  html = html
    .replace(/\{\{name\}\}/g, data.name)
    .replace(/\{\{lastname\}\}/g, data.lastname)
    .replace(/\{\{email\}\}/g, data.email)
    .replace(/\{\{phone\}\}/g, data.phone)
    .replace(/\{\{message\}\}/g, data.message);

  const subject = `Nuevo mensaje de contacto - ${data.name} ${data.lastname}`;

  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: process.env['EMAIL_SOURCE'],
        Destination: {
          ToAddresses: [process.env['DESTINATION_EMAIL'] ?? ''],
        },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      }),
    );
    console.log(`[sendEmail] Email sent successfully for message id: ${data.id}`);
  } catch (error) {
    console.error(`[sendEmail] Failed to send email for message id: ${data.id}`, error);
    throw error;
  }
};
