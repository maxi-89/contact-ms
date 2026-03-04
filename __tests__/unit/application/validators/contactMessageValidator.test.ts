import { validateContactMessage } from '../../../../src/application/validators/contactMessageValidator';
import { ValidationError } from '../../../../src/infrastructure/errors/ValidationError';

const validBody = {
  name: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  phone: '+1-555-0100',
  message: 'Hello, I would like to get in touch.',
};

describe('validateContactMessage', () => {
  describe('happy path', () => {
    it('should return validated data when all fields are valid', () => {
      const result = validateContactMessage(validBody);
      expect(result).toEqual(validBody);
    });

    it('should trim whitespace from all string fields', () => {
      const result = validateContactMessage({
        name: '  John  ',
        lastname: '  Doe  ',
        email: '  john@example.com  ',
        phone: '  +1-555-0100  ',
        message: '  Hello, I would like to get in touch.  ',
      });
      expect(result.name).toBe('John');
      expect(result.lastname).toBe('Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('+1-555-0100');
      expect(result.message).toBe('Hello, I would like to get in touch.');
    });
  });

  describe('body shape', () => {
    it('should throw ValidationError when body is null', () => {
      expect(() => validateContactMessage(null)).toThrow(ValidationError);
    });

    it('should throw ValidationError when body is a string', () => {
      expect(() => validateContactMessage('hello')).toThrow(ValidationError);
    });

    it('should throw ValidationError when body is a number', () => {
      expect(() => validateContactMessage(42)).toThrow(ValidationError);
    });

    it('should throw ValidationError when body is an array', () => {
      expect(() => validateContactMessage([])).toThrow(ValidationError);
    });
  });

  describe('name', () => {
    it('should throw ValidationError when name is missing', () => {
      const { name: _, ...rest } = validBody;
      expect(() => validateContactMessage(rest)).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is too short (1 char)', () => {
      expect(() => validateContactMessage({ ...validBody, name: 'J' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is too long (101 chars)', () => {
      expect(() => validateContactMessage({ ...validBody, name: 'a'.repeat(101) })).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is an empty string', () => {
      expect(() => validateContactMessage({ ...validBody, name: '' })).toThrow(ValidationError);
    });
  });

  describe('lastname', () => {
    it('should throw ValidationError when lastname is missing', () => {
      const { lastname: _, ...rest } = validBody;
      expect(() => validateContactMessage(rest)).toThrow(ValidationError);
    });

    it('should throw ValidationError when lastname is too short (1 char)', () => {
      expect(() => validateContactMessage({ ...validBody, lastname: 'D' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when lastname is too long (101 chars)', () => {
      expect(() => validateContactMessage({ ...validBody, lastname: 'a'.repeat(101) })).toThrow(ValidationError);
    });
  });

  describe('email', () => {
    it('should throw ValidationError when email is missing', () => {
      const { email: _, ...rest } = validBody;
      expect(() => validateContactMessage(rest)).toThrow(ValidationError);
    });

    it('should throw ValidationError when email has no @ symbol', () => {
      expect(() => validateContactMessage({ ...validBody, email: 'notanemail' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when email has no domain part', () => {
      expect(() => validateContactMessage({ ...validBody, email: 'user@' })).toThrow(ValidationError);
    });
  });

  describe('phone', () => {
    it('should throw ValidationError when phone is missing', () => {
      const { phone: _, ...rest } = validBody;
      expect(() => validateContactMessage(rest)).toThrow(ValidationError);
    });

    it('should throw ValidationError when phone is too short (5 chars)', () => {
      expect(() => validateContactMessage({ ...validBody, phone: '12345' })).toThrow(ValidationError);
    });

    it('should throw ValidationError when phone is too long (21 chars)', () => {
      expect(() => validateContactMessage({ ...validBody, phone: '1'.repeat(21) })).toThrow(ValidationError);
    });
  });

  describe('message', () => {
    it('should throw ValidationError when message is missing', () => {
      const { message: _, ...rest } = validBody;
      expect(() => validateContactMessage(rest)).toThrow(ValidationError);
    });

    it('should throw ValidationError when message is too short (9 chars)', () => {
      expect(() => validateContactMessage({ ...validBody, message: 'a'.repeat(9) })).toThrow(ValidationError);
    });

    it('should throw ValidationError when message is too long (1001 chars)', () => {
      expect(() => validateContactMessage({ ...validBody, message: 'a'.repeat(1001) })).toThrow(ValidationError);
    });
  });
});
