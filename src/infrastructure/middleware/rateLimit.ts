import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../aws/dynamodbClient';
import { AppError } from '../errors/AppError';

const MAX_REQUESTS_PER_IP_PER_HOUR = 5;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 2;
const MIN_SECONDS_BETWEEN_REQUESTS = 300;
const HOUR_MS = 3_600_000;

function currentHourTimestamp(): number {
  return Math.floor(Date.now() / HOUR_MS) * 3600;
}

function secondsUntilNextHour(): number {
  const hourTimestamp = currentHourTimestamp();
  const nextHour = (hourTimestamp + 3600) * 1000;
  return Math.ceil((nextHour - Date.now()) / 1000);
}

export async function checkRateLimit(clientIp: string, email: string): Promise<void> {
  const hourTimestamp = currentHourTimestamp();
  const now = Date.now();
  const table = process.env['RATE_LIMIT_TABLE'] ?? '';

  try {
    const [ipResult, emailResult] = await Promise.all([
      dynamodb.send(
        new GetCommand({
          TableName: table,
          Key: { PK: `IP#${clientIp}`, SK: `WINDOW#${hourTimestamp}` },
        }),
      ),
      dynamodb.send(
        new GetCommand({
          TableName: table,
          Key: { PK: `EMAIL#${email}`, SK: `WINDOW#${hourTimestamp}` },
        }),
      ),
    ]);

    const ipItem = ipResult.Item as
      | { count: number; lastRequestAt: number }
      | undefined;
    const emailItem = emailResult.Item as { count: number } | undefined;

    const ipCount = ipItem?.count ?? 0;
    const emailCount = emailItem?.count ?? 0;
    const lastRequestAt = ipItem?.lastRequestAt ?? 0;

    const retryAfter = secondsUntilNextHour();

    if (ipCount >= MAX_REQUESTS_PER_IP_PER_HOUR) {
      throw new AppError(`Rate limit exceeded. Retry in ${retryAfter} seconds.`, 429);
    }

    if (emailCount >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
      throw new AppError(`Rate limit exceeded. Retry in ${retryAfter} seconds.`, 429);
    }

    if (lastRequestAt > 0 && now - lastRequestAt < MIN_SECONDS_BETWEEN_REQUESTS * 1000) {
      const cooldownRemaining = Math.ceil(
        (MIN_SECONDS_BETWEEN_REQUESTS * 1000 - (now - lastRequestAt)) / 1000,
      );
      throw new AppError(`Rate limit exceeded. Retry in ${cooldownRemaining} seconds.`, 429);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('[rateLimit] DynamoDB read error — failing open:', error);
    return;
  }

  const ttl = currentHourTimestamp() + 7200;

  try {
    await Promise.all([
      dynamodb.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: `IP#${clientIp}`, SK: `WINDOW#${hourTimestamp}` },
          UpdateExpression: 'ADD #count :inc SET #lastRequestAt = :now, #ttl = :ttl',
          ExpressionAttributeNames: {
            '#count': 'count',
            '#lastRequestAt': 'lastRequestAt',
            '#ttl': 'ttl',
          },
          ExpressionAttributeValues: { ':inc': 1, ':now': now, ':ttl': ttl },
        }),
      ),
      dynamodb.send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: `EMAIL#${email}`, SK: `WINDOW#${hourTimestamp}` },
          UpdateExpression: 'ADD #count :inc SET #ttl = :ttl',
          ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
          ExpressionAttributeValues: { ':inc': 1, ':ttl': ttl },
        }),
      ),
    ]);
  } catch (error) {
    console.error('[rateLimit] DynamoDB write error — failing open:', error);
  }
}
