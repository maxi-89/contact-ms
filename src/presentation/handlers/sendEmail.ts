import path from 'path';
import type { SQSHandler } from 'aws-lambda';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { sesClient } from '../../infrastructure/aws/sesClient';
import { renderTemplate } from '../../infrastructure/email/renderTemplate';

interface ContactMessageData {
  id: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  message: string;
  timestamp: number;
}

interface ProjectRequestData {
  id: string;
  name: string;
  email: string;
  projectType: string;
  description: string;
  budget?: string;
  timestamp: number;
}

type SqsMessageBody =
  | { type: 'contact_message'; data: ContactMessageData }
  | { type: 'project_request'; data: ProjectRequestData }
  | { type: string; data: Record<string, unknown> };

async function sendSesEmail(subject: string, html: string): Promise<void> {
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
}

export const handler: SQSHandler = async (event): Promise<void> => {
  const record = event.Records[0];
  const payload = JSON.parse(record.body) as SqsMessageBody;

  if (payload.type === 'contact_message') {
    const data = payload.data as ContactMessageData;
    const templatePath = path.join(__dirname, '../templates/emailTemplate.html');

    const html = renderTemplate(templatePath, {
      name: data.name,
      lastname: data.lastname,
      email: data.email,
      phone: data.phone,
      message: data.message,
    });

    const subject = `Nuevo mensaje de contacto - ${data.name} ${data.lastname}`;

    try {
      await sendSesEmail(subject, html);
      console.log(`[sendEmail] Email sent successfully for message id: ${data.id}`);
    } catch (error) {
      console.error(`[sendEmail] Failed to send email for message id: ${data.id}`, error);
      throw error;
    }
  } else if (payload.type === 'project_request') {
    const data = payload.data as ProjectRequestData;
    const templatePath = path.join(__dirname, '../templates/projectRequestTemplate.html');

    const html = renderTemplate(templatePath, {
      name: data.name,
      email: data.email,
      projectType: data.projectType,
      description: data.description,
      budget: data.budget ?? 'No especificado',
    });

    const subject = `Nuevo pedido de proyecto - ${data.name}`;

    try {
      await sendSesEmail(subject, html);
      console.log(`[sendEmail] Project request email sent successfully for id: ${data.id}`);
    } catch (error) {
      console.error(`[sendEmail] Failed to send project request email for id: ${data.id}`, error);
      throw error;
    }
  } else {
    console.warn(`[sendEmail] Unknown message type: ${payload.type} — skipping`);
  }
};
