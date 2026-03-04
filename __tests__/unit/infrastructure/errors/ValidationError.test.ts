import { ValidationError } from '../../../../src/infrastructure/errors/ValidationError';

describe('ValidationError', () => {
  it('should set name to "ValidationError"', () => {
    const error = new ValidationError('field is required');
    expect(error.name).toBe('ValidationError');
  });

  it('should set message correctly', () => {
    const error = new ValidationError('email is invalid');
    expect(error.message).toBe('email is invalid');
  });

  it('should be instanceof Error', () => {
    const error = new ValidationError('bad input');
    expect(error).toBeInstanceOf(Error);
  });
});
