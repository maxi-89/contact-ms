import { AppError } from '../../../../src/infrastructure/errors/AppError';

describe('AppError', () => {
  it('should set name to "AppError"', () => {
    const error = new AppError('something failed');
    expect(error.name).toBe('AppError');
  });

  it('should set default statusCode to 500', () => {
    const error = new AppError('something failed');
    expect(error.statusCode).toBe(500);
  });

  it('should accept a custom statusCode', () => {
    const error = new AppError('rate limited', 429);
    expect(error.statusCode).toBe(429);
  });

  it('should set message correctly', () => {
    const error = new AppError('custom message');
    expect(error.message).toBe('custom message');
  });

  it('should be instanceof Error', () => {
    const error = new AppError('oops');
    expect(error).toBeInstanceOf(Error);
  });
});
