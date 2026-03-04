import { v1 as uuidv1 } from 'uuid';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { validateContactMessage } from '../validators/contactMessageValidator';
import { ContactMessage } from '../../domain/models/ContactMessage';
import { checkRateLimit } from '../../infrastructure/middleware/rateLimit';
import { sqsClient } from '../../infrastructure/aws/sqsClient';

export async function processContactMessage(
  rawBody: unknown,
  clientIp: string,
): Promise<{ id: string; messageId: string }> {
  const validatedData = validateContactMessage(rawBody);

  await checkRateLimit(clientIp, validatedData.email);

  const id = uuidv1();
  const message = new ContactMessage(id, validatedData);
  const payload = message.toQueuePayload();

  const response = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: process.env['PENDING_MESSAGES_QUEUE'],
      MessageBody: JSON.stringify(payload),
    }),
  );

  return { id, messageId: response.MessageId ?? '' };
}
