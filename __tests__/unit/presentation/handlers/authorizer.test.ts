import type { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { handler } from '../../../../src/presentation/handlers/authorizer';

function makeEvent(origin: string | null): APIGatewayRequestAuthorizerEvent {
  return {
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789:api/dev/POST/message',
    headers: origin !== null ? { origin } : null,
    multiValueHeaders: null,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayRequestAuthorizerEvent['requestContext'],
    resource: '/message',
    path: '/message',
    httpMethod: 'POST',
  };
}

beforeEach(() => {
  process.env['CLOUDFRONT_DOMAIN'] = 'test.cloudfront.net';
});

afterEach(() => {
  delete process.env['CLOUDFRONT_DOMAIN'];
});

function getEffect(result: APIGatewayAuthorizerResult): string {
  return result.policyDocument.Statement[0]?.Effect ?? '';
}

describe('authorizer handler', () => {
  it('should return Allow policy when origin matches CloudFront domain', async () => {
    const result = await handler(makeEvent('https://test.cloudfront.net'), {} as never, () => undefined);
    expect(getEffect(result as APIGatewayAuthorizerResult)).toBe('Allow');
  });

  it('should return Allow policy when origin is http://localhost:3000', async () => {
    const result = await handler(makeEvent('http://localhost:3000'), {} as never, () => undefined);
    expect(getEffect(result as APIGatewayAuthorizerResult)).toBe('Allow');
  });

  it('should return Allow policy when origin is http://localhost:5173', async () => {
    const result = await handler(makeEvent('http://localhost:5173'), {} as never, () => undefined);
    expect(getEffect(result as APIGatewayAuthorizerResult)).toBe('Allow');
  });

  it('should return Deny policy when origin is not in allowlist', async () => {
    const result = await handler(makeEvent('https://evil.com'), {} as never, () => undefined);
    expect(getEffect(result as APIGatewayAuthorizerResult)).toBe('Deny');
  });

  it('should return Deny policy when origin header is missing', async () => {
    const result = await handler(makeEvent(null), {} as never, () => undefined);
    expect(getEffect(result as APIGatewayAuthorizerResult)).toBe('Deny');
  });

  it('should return Deny when CLOUDFRONT_DOMAIN is not set and origin is not localhost', async () => {
    delete process.env['CLOUDFRONT_DOMAIN'];
    const result = await handler(makeEvent('https://other.com'), {} as never, () => undefined);
    expect(getEffect(result as APIGatewayAuthorizerResult)).toBe('Deny');
  });
});
