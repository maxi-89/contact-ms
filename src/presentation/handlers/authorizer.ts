import type {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Handler,
} from 'aws-lambda';

type AuthorizerHandler = Handler<APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult>;

function buildPolicy(effect: 'Allow' | 'Deny', methodArn: string): APIGatewayAuthorizerResult {
  return {
    principalId: 'contact-ms-client',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: methodArn,
        },
      ],
    },
  };
}

export const handler: AuthorizerHandler = async (event) => {
  const cloudfrontDomain = process.env['CLOUDFRONT_DOMAIN'] ?? '';

  const allowlist = [
    `https://${cloudfrontDomain}`,
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const origin = event.headers?.['origin'] ?? event.headers?.['Origin'] ?? null;

  if (origin !== null && allowlist.includes(origin)) {
    return buildPolicy('Allow', event.methodArn);
  }

  return buildPolicy('Deny', event.methodArn);
};
