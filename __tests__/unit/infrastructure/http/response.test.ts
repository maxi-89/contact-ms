import { ok, badRequest, tooManyRequests, internalServerError } from '../../../../src/infrastructure/http/response';

const EXPECTED_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

describe('response helpers', () => {
  describe('ok()', () => {
    it('should return statusCode 200 with JSON-serialized body', () => {
      const result = ok({ id: 'abc', message: 'done' });
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ id: 'abc', message: 'done' });
    });

    it('should include Content-Type and CORS headers', () => {
      const result = ok({});
      expect(result.headers).toMatchObject(EXPECTED_HEADERS);
    });
  });

  describe('badRequest()', () => {
    it('should return statusCode 400 with { error: message }', () => {
      const result = badRequest('name is required');
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'name is required' });
    });

    it('should include correct headers', () => {
      const result = badRequest('bad');
      expect(result.headers).toMatchObject(EXPECTED_HEADERS);
    });
  });

  describe('tooManyRequests()', () => {
    it('should return statusCode 429 with { error: message }', () => {
      const result = tooManyRequests('Rate limit exceeded');
      expect(result.statusCode).toBe(429);
      expect(JSON.parse(result.body)).toMatchObject({ error: 'Rate limit exceeded' });
    });

    it('should include retryAfter in body when provided', () => {
      const result = tooManyRequests('Rate limit exceeded', 120);
      expect(JSON.parse(result.body)).toEqual({ error: 'Rate limit exceeded', retryAfter: 120 });
    });

    it('should not include retryAfter when not provided', () => {
      const result = tooManyRequests('Rate limit exceeded');
      expect(JSON.parse(result.body)).not.toHaveProperty('retryAfter');
    });
  });

  describe('internalServerError()', () => {
    it('should return statusCode 500 with { error: "Internal server error" }', () => {
      const result = internalServerError();
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });
    });

    it('should include correct headers', () => {
      const result = internalServerError();
      expect(result.headers).toMatchObject(EXPECTED_HEADERS);
    });
  });
});
