import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { processProjectRequest } from '../../application/services/projectRequestService';
import { ValidationError } from '../../infrastructure/errors/ValidationError';
import { AppError } from '../../infrastructure/errors/AppError';
import { ok, badRequest, tooManyRequests, internalServerError } from '../../infrastructure/http/response';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const clientIp = event.requestContext.identity.sourceIp ?? 'unknown';

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(event.body ?? '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    await processProjectRequest(parsedBody, clientIp);
    return ok({ message: 'Message received' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }
    if (error instanceof AppError && error.statusCode === 429) {
      return tooManyRequests(error.message);
    }
    console.error('[receiveProjectRequest] Unhandled error:', error);
    return internalServerError();
  }
};
