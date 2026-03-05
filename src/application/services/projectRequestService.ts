import { v1 as uuidv1 } from 'uuid';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { validateProjectRequest } from '../validators/projectRequestValidator';
import { ProjectRequest } from '../../domain/models/ProjectRequest';
import { checkRateLimit } from '../../infrastructure/middleware/rateLimit';
import { sqsClient } from '../../infrastructure/aws/sqsClient';

export async function processProjectRequest(
  rawBody: unknown,
  clientIp: string,
): Promise<{ id: string; messageId: string }> {
  const validatedData = validateProjectRequest(rawBody);

  await checkRateLimit(clientIp, validatedData.email);

  const id = uuidv1();
  const request = new ProjectRequest(id, validatedData);
  const payload = request.toQueuePayload();

  const response = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: process.env['PENDING_MESSAGES_QUEUE'],
      MessageBody: JSON.stringify(payload),
    }),
  );

  return { id, messageId: response.MessageId ?? '' };
}
