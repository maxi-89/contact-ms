import { processContactMessage } from '../../../../src/application/services/contactMessageService';
import { ValidationError } from '../../../../src/infrastructure/errors/ValidationError';
import { AppError } from '../../../../src/infrastructure/errors/AppError';
import { sqsClient } from '../../../../src/infrastructure/aws/sqsClient';
import { checkRateLimit } from '../../../../src/infrastructure/middleware/rateLimit';

jest.mock('../../../../src/infrastructure/aws/sqsClient', () => ({
  sqsClient: { send: jest.fn() },
}));

jest.mock('../../../../src/infrastructure/middleware/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock('uuid', () => ({ v1: () => 'mock-uuid-1234' }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSqsSend = sqsClient.send as jest.MockedFunction<(cmd: any) => Promise<any>>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const validBody = {
  name: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  phone: '+1-555-0100',
  message: 'Hello, I would like to get in touch.',
};

beforeEach(() => {
  process.env['PENDING_MESSAGES_QUEUE'] = 'https://sqs.us-east-1.amazonaws.com/123/queue';
  mockSqsSend.mockResolvedValue({ MessageId: 'sqs-msg-id-42' });
  mockCheckRateLimit.mockResolvedValue(undefined);
});

describe('processContactMessage', () => {
  describe('happy path', () => {
    it('should return id and messageId when data is valid', async () => {
      const result = await processContactMessage(validBody, '1.2.3.4');
      expect(result.id).toBe('mock-uuid-1234');
      expect(result.messageId).toBe('sqs-msg-id-42');
    });

    it('should call SQS SendMessageCommand with the correct QueueUrl', async () => {
      await processContactMessage(validBody, '1.2.3.4');
      const call = mockSqsSend.mock.calls[0][0];
      expect(call.input.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue');
    });

    it('should call SQS with a payload where type is "contact_message"', async () => {
      await processContactMessage(validBody, '1.2.3.4');
      const call = mockSqsSend.mock.calls[0][0];
      const body = JSON.parse(call.input.MessageBody as string) as { type: string };
      expect(body.type).toBe('contact_message');
    });
  });

  describe('validation', () => {
    it('should throw ValidationError when body is invalid', async () => {
      await expect(processContactMessage({ name: '' }, '1.2.3.4')).rejects.toThrow(ValidationError);
    });
  });

  describe('rate limit', () => {
    it('should throw AppError(429) when checkRateLimit throws', async () => {
      mockCheckRateLimit.mockRejectedValue(new AppError('Rate limit exceeded.', 429));
      await expect(processContactMessage(validBody, '1.2.3.4')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('SQS error', () => {
    it('should propagate error when SQS send fails', async () => {
      mockSqsSend.mockRejectedValue(new Error('SQS unavailable'));
      await expect(processContactMessage(validBody, '1.2.3.4')).rejects.toThrow('SQS unavailable');
    });
  });
});
