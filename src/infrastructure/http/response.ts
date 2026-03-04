import type { APIGatewayProxyResult } from 'aws-lambda';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export function ok(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function tooManyRequests(message: string, retryAfter?: number): APIGatewayProxyResult {
  const body: { error: string; retryAfter?: number } = { error: message };
  if (retryAfter !== undefined) {
    body.retryAfter = retryAfter;
  }
  return {
    statusCode: 429,
    headers: HEADERS,
    body: JSON.stringify(body),
  };
}

export function internalServerError(): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: HEADERS,
    body: JSON.stringify({ error: 'Internal server error' }),
  };
}
