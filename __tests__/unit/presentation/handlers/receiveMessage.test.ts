import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../../src/presentation/handlers/receiveMessage';
import { processContactMessage } from '../../../../src/application/services/contactMessageService';
import { ValidationError } from '../../../../src/infrastructure/errors/ValidationError';
import { AppError } from '../../../../src/infrastructure/errors/AppError';

jest.mock('../../../../src/application/services/contactMessageService', () => ({
  processContactMessage: jest.fn(),
}));

const mockProcess = processContactMessage as jest.MockedFunction<typeof processContactMessage>;

function makeEvent(body: unknown, sourceIp = '1.2.3.4'): APIGatewayProxyEvent {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    requestContext: {
      identity: { sourceIp },
    },
  } as unknown as APIGatewayProxyEvent;
}

beforeEach(() => {
  mockProcess.mockResolvedValue({ id: 'msg-id', messageId: 'sqs-id' });
});

describe('receiveMessage handler', () => {
  it('should return 200 with { message: "Message received" } on valid request', async () => {
    const result = await handler(makeEvent({ name: 'John' }), {} as never, () => undefined);
    expect(result?.statusCode).toBe(200);
    expect(JSON.parse(result?.body ?? '{}')).toEqual({ message: 'Message received' });
  });

  it('should return 400 when body is invalid JSON', async () => {
    const event = { ...makeEvent(''), body: '{invalid-json' };
    const result = await handler(event, {} as never, () => undefined);
    expect(result?.statusCode).toBe(400);
    expect(JSON.parse(result?.body ?? '{}')).toMatchObject({ error: 'Invalid JSON body' });
  });

  it('should return 400 when validation fails (ValidationError)', async () => {
    mockProcess.mockRejectedValue(new ValidationError('Validation failed: name is required'));
    const result = await handler(makeEvent({ name: '' }), {} as never, () => undefined);
    expect(result?.statusCode).toBe(400);
    expect(JSON.parse(result?.body ?? '{}')).toMatchObject({ error: 'Validation failed: name is required' });
  });

  it('should return 429 when rate limit is exceeded (AppError 429)', async () => {
    mockProcess.mockRejectedValue(new AppError('Rate limit exceeded. Retry in 120 seconds.', 429));
    const result = await handler(makeEvent({ name: 'John' }), {} as never, () => undefined);
    expect(result?.statusCode).toBe(429);
    expect(JSON.parse(result?.body ?? '{}')).toMatchObject({ error: 'Rate limit exceeded. Retry in 120 seconds.' });
  });

  it('should return 500 on unexpected error', async () => {
    mockProcess.mockRejectedValue(new Error('Something exploded'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await handler(makeEvent({ name: 'John' }), {} as never, () => undefined);
    expect(result?.statusCode).toBe(500);
    expect(JSON.parse(result?.body ?? '{}')).toMatchObject({ error: 'Internal server error' });
    consoleSpy.mockRestore();
  });
});
