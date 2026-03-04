import { checkRateLimit } from '../../../../src/infrastructure/middleware/rateLimit';
import { AppError } from '../../../../src/infrastructure/errors/AppError';
import { dynamodb } from '../../../../src/infrastructure/aws/dynamodbClient';

jest.mock('../../../../src/infrastructure/aws/dynamodbClient', () => ({
  dynamodb: { send: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = dynamodb.send as jest.MockedFunction<(cmd: any) => Promise<any>>;

const NOW = 1_700_000_000_000; // fixed timestamp for determinism
const HOUR_MS = 3_600_000;
const HOUR_TIMESTAMP = Math.floor(NOW / HOUR_MS) * 3600;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

function makeGetResponse(overrides: {
  ipCount?: number;
  emailCount?: number;
  lastRequestAt?: number;
}): void {
  mockSend.mockImplementation(async (command) => {
    const cmd = command as { input: { Key?: { PK?: string } } };
    const pk = cmd.input?.Key?.PK ?? '';

    if (pk.startsWith('IP#')) {
      return {
        Item:
          overrides.ipCount !== undefined
            ? { count: overrides.ipCount, lastRequestAt: overrides.lastRequestAt ?? NOW - 400_000 }
            : undefined,
      };
    }
    if (pk.startsWith('EMAIL#')) {
      return {
        Item:
          overrides.emailCount !== undefined ? { count: overrides.emailCount } : undefined,
      };
    }
    return {};
  });
}

describe('checkRateLimit', () => {
  describe('happy path', () => {
    it('should return void when both IP and email counts are below limits', async () => {
      makeGetResponse({ ipCount: 2, emailCount: 1 });
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).resolves.toBeUndefined();
    });

    it('should return void when there are no existing records', async () => {
      makeGetResponse({});
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('IP rate limit', () => {
    it('should throw AppError(429) when IP count reaches 5', async () => {
      makeGetResponse({ ipCount: 5, emailCount: 0 });
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).rejects.toThrow(AppError);
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('email rate limit', () => {
    it('should throw AppError(429) when email count reaches 2', async () => {
      makeGetResponse({ ipCount: 1, emailCount: 2 });
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).rejects.toThrow(AppError);
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('cooldown', () => {
    it('should throw AppError(429) when last request from IP was < 300s ago', async () => {
      makeGetResponse({ ipCount: 1, emailCount: 0, lastRequestAt: NOW - 100_000 }); // 100s ago
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).rejects.toThrow(AppError);
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('fail open', () => {
    it('should not throw when DynamoDB GetCommand throws — logs error instead', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB unavailable'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not throw when DynamoDB UpdateCommand throws — logs error instead', async () => {
      // GetCommands succeed, UpdateCommand throws
      let callCount = 0;
      mockSend.mockImplementation(async (command) => {
        const cmd = command as { constructor: { name: string } };
        if (cmd.constructor.name === 'UpdateCommand') {
          throw new Error('DynamoDB write failed');
        }
        callCount++;
        const pk =
          callCount === 1
            ? 'IP#1.2.3.4'
            : 'EMAIL#user@example.com';
        if (pk.startsWith('IP#')) {
          return { Item: { count: 1, lastRequestAt: NOW - 400_000 } };
        }
        return { Item: { count: 0 } };
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(checkRateLimit('1.2.3.4', 'user@example.com')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
