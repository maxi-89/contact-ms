import type { SQSEvent } from 'aws-lambda';
import { sesClient } from '../../../../src/infrastructure/aws/sesClient';

jest.mock('../../../../src/infrastructure/aws/sesClient', () => ({
  sesClient: { send: jest.fn() },
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(
    '<html>{{name}} {{lastname}} {{email}} {{phone}} {{message}}</html>',
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSesSend = sesClient.send as jest.MockedFunction<(cmd: any) => Promise<any>>;

function makeEvent(data: Record<string, unknown>): SQSEvent {
  return {
    Records: [
      {
        body: JSON.stringify({ type: 'contact_message', data }),
        messageId: 'sqs-record-id',
        receiptHandle: 'handle',
        attributes: {} as never,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
        awsRegion: 'us-east-1',
      },
    ],
  };
}

const validData = {
  id: 'msg-id-123',
  name: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  phone: '+1-555-0100',
  message: 'Hello there.',
  timestamp: 1_700_000_000_000,
};

beforeEach(() => {
  process.env['EMAIL_SOURCE'] = 'no-reply@example.com';
  process.env['DESTINATION_EMAIL'] = 'contact@example.com';
  mockSesSend.mockResolvedValue({});
});

describe('sendEmail handler', () => {
  it('should call SES SendEmailCommand with correct Source and Destination', async () => {
    const { handler } = await import('../../../../src/presentation/handlers/sendEmail');
    await handler(makeEvent(validData), {} as never, () => undefined);

    expect(mockSesSend).toHaveBeenCalledTimes(1);
    const cmd = mockSesSend.mock.calls[0][0];
    expect(cmd.input.Source).toBe('no-reply@example.com');
    expect(cmd.input.Destination.ToAddresses).toEqual(['contact@example.com']);
  });

  it('should replace all placeholders in the HTML template', async () => {
    const { handler } = await import('../../../../src/presentation/handlers/sendEmail');
    await handler(makeEvent(validData), {} as never, () => undefined);

    const cmd = mockSesSend.mock.calls[0][0];
    const html: string = cmd.input.Message.Body.Html.Data;
    expect(html).toContain('John');
    expect(html).toContain('Doe');
    expect(html).toContain('john@example.com');
    expect(html).toContain('+1-555-0100');
    expect(html).toContain('Hello there.');
    expect(html).not.toContain('{{name}}');
    expect(html).not.toContain('{{lastname}}');
    expect(html).not.toContain('{{email}}');
    expect(html).not.toContain('{{phone}}');
    expect(html).not.toContain('{{message}}');
  });

  it('should use EMAIL_SOURCE and DESTINATION_EMAIL env vars', async () => {
    process.env['EMAIL_SOURCE'] = 'sender@myapp.com';
    process.env['DESTINATION_EMAIL'] = 'admin@myapp.com';

    const { handler } = await import('../../../../src/presentation/handlers/sendEmail');
    await handler(makeEvent(validData), {} as never, () => undefined);

    const cmd = mockSesSend.mock.calls[0][0];
    expect(cmd.input.Source).toBe('sender@myapp.com');
    expect(cmd.input.Destination.ToAddresses).toEqual(['admin@myapp.com']);
  });

  it('should re-throw on SES error so SQS can retry', async () => {
    mockSesSend.mockRejectedValue(new Error('SES SendEmail failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { handler } = await import('../../../../src/presentation/handlers/sendEmail');
    await expect(handler(makeEvent(validData), {} as never, () => undefined)).rejects.toThrow('SES SendEmail failed');
    consoleSpy.mockRestore();
  });

  it('should log the message id on success', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const { handler } = await import('../../../../src/presentation/handlers/sendEmail');
    await handler(makeEvent(validData), {} as never, () => undefined);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('msg-id-123'));
    consoleSpy.mockRestore();
  });
});
