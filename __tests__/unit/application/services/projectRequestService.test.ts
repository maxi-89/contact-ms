import { processProjectRequest } from '../../../../src/application/services/projectRequestService';
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
  name: 'Jane Doe',
  email: 'jane@example.com',
  projectType: 'Website',
  description: 'I need a new e-commerce site.',
};

beforeEach(() => {
  process.env['PENDING_MESSAGES_QUEUE'] = 'https://sqs.us-east-1.amazonaws.com/123/queue';
  mockSqsSend.mockResolvedValue({ MessageId: 'sqs-msg-id-99' });
  mockCheckRateLimit.mockResolvedValue(undefined);
});

describe('processProjectRequest', () => {
  describe('happy path', () => {
    it('should return id and messageId when data is valid', async () => {
      const result = await processProjectRequest(validBody, '1.2.3.4');
      expect(result.id).toBe('mock-uuid-1234');
      expect(result.messageId).toBe('sqs-msg-id-99');
    });

    it('should call SQS with PENDING_MESSAGES_QUEUE url', async () => {
      await processProjectRequest(validBody, '1.2.3.4');
      const call = mockSqsSend.mock.calls[0][0];
      expect(call.input.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue');
    });

    it('should set type "project_request" in SQS payload', async () => {
      await processProjectRequest(validBody, '1.2.3.4');
      const call = mockSqsSend.mock.calls[0][0];
      const body = JSON.parse(call.input.MessageBody as string) as { type: string };
      expect(body.type).toBe('project_request');
    });
  });

  describe('validation', () => {
    it('should throw ValidationError when body is invalid', async () => {
      await expect(processProjectRequest({ name: '' }, '1.2.3.4')).rejects.toThrow(ValidationError);
    });
  });

  describe('rate limit', () => {
    it('should throw AppError(429) when checkRateLimit throws', async () => {
      mockCheckRateLimit.mockRejectedValue(new AppError('Rate limit exceeded.', 429));
      await expect(processProjectRequest(validBody, '1.2.3.4')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('SQS error', () => {
    it('should propagate error when SQS send fails', async () => {
      mockSqsSend.mockRejectedValue(new Error('SQS unavailable'));
      await expect(processProjectRequest(validBody, '1.2.3.4')).rejects.toThrow('SQS unavailable');
    });
  });
});
