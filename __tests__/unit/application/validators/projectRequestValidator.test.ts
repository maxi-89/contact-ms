import { validateProjectRequest } from '../../../../src/application/validators/projectRequestValidator';
import { ValidationError } from '../../../../src/infrastructure/errors/ValidationError';

const validBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  projectType: 'Website',
  description: 'I need a new e-commerce site.',
};

describe('validateProjectRequest', () => {
  describe('happy path', () => {
    it('should return validated data when all required fields are valid', () => {
      const result = validateProjectRequest(validBody);
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane@example.com');
      expect(result.projectType).toBe('Website');
      expect(result.description).toBe('I need a new e-commerce site.');
      expect(result.budget).toBeUndefined();
    });

    it('should return data with undefined budget when not provided', () => {
      const result = validateProjectRequest(validBody);
      expect(result.budget).toBeUndefined();
    });

    it('should trim whitespace from all string fields', () => {
      const result = validateProjectRequest({
        name: '  Jane  ',
        email: '  jane@example.com  ',
        projectType: '  Website  ',
        description: '  I need a new e-commerce site.  ',
        budget: '  5000-10000  ',
      });
      expect(result.name).toBe('Jane');
      expect(result.email).toBe('jane@example.com');
      expect(result.projectType).toBe('Website');
      expect(result.description).toBe('I need a new e-commerce site.');
      expect(result.budget).toBe('5000-10000');
    });

    it('should accept budget when present and within 100 chars', () => {
      const result = validateProjectRequest({ ...validBody, budget: '5000-10000' });
      expect(result.budget).toBe('5000-10000');
    });
  });

  describe('validation errors', () => {
    it('should throw ValidationError when body is not an object', () => {
      expect(() => validateProjectRequest('string')).toThrow(ValidationError);
      expect(() => validateProjectRequest(null)).toThrow(ValidationError);
      expect(() => validateProjectRequest(42)).toThrow(ValidationError);
      expect(() => validateProjectRequest([])).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is missing', () => {
      expect(() => validateProjectRequest({ ...validBody, name: undefined })).toThrow(
        'Validation failed: name must be between 2 and 100 characters',
      );
    });

    it('should throw ValidationError when name is shorter than 2 chars', () => {
      expect(() => validateProjectRequest({ ...validBody, name: 'A' })).toThrow(
        'Validation failed: name must be between 2 and 100 characters',
      );
    });

    it('should throw ValidationError when name is longer than 100 chars', () => {
      expect(() => validateProjectRequest({ ...validBody, name: 'A'.repeat(101) })).toThrow(
        'Validation failed: name must be between 2 and 100 characters',
      );
    });

    it('should throw ValidationError when email is missing', () => {
      expect(() => validateProjectRequest({ ...validBody, email: undefined })).toThrow(
        'Validation failed: email must be a valid email address',
      );
    });

    it('should throw ValidationError when email format is invalid', () => {
      expect(() => validateProjectRequest({ ...validBody, email: 'not-an-email' })).toThrow(
        'Validation failed: email must be a valid email address',
      );
    });

    it('should throw ValidationError when projectType is missing', () => {
      expect(() => validateProjectRequest({ ...validBody, projectType: undefined })).toThrow(
        'Validation failed: projectType must be between 2 and 100 characters',
      );
    });

    it('should throw ValidationError when projectType is shorter than 2 chars', () => {
      expect(() => validateProjectRequest({ ...validBody, projectType: 'A' })).toThrow(
        'Validation failed: projectType must be between 2 and 100 characters',
      );
    });

    it('should throw ValidationError when projectType is longer than 100 chars', () => {
      expect(() => validateProjectRequest({ ...validBody, projectType: 'A'.repeat(101) })).toThrow(
        'Validation failed: projectType must be between 2 and 100 characters',
      );
    });

    it('should throw ValidationError when description is missing', () => {
      expect(() => validateProjectRequest({ ...validBody, description: undefined })).toThrow(
        'Validation failed: description must be between 10 and 2000 characters',
      );
    });

    it('should throw ValidationError when description is shorter than 10 chars', () => {
      expect(() => validateProjectRequest({ ...validBody, description: 'Short' })).toThrow(
        'Validation failed: description must be between 10 and 2000 characters',
      );
    });

    it('should throw ValidationError when description is longer than 2000 chars', () => {
      expect(() =>
        validateProjectRequest({ ...validBody, description: 'A'.repeat(2001) }),
      ).toThrow('Validation failed: description must be between 10 and 2000 characters');
    });

    it('should throw ValidationError when budget is present but longer than 100 chars', () => {
      expect(() =>
        validateProjectRequest({ ...validBody, budget: 'A'.repeat(101) }),
      ).toThrow('Validation failed: budget must be at most 100 characters');
    });
  });

  describe('edge cases', () => {
    it('should treat empty string budget as missing (undefined)', () => {
      const result = validateProjectRequest({ ...validBody, budget: '' });
      expect(result.budget).toBeUndefined();
    });

    it('should treat whitespace-only budget as missing (undefined)', () => {
      const result = validateProjectRequest({ ...validBody, budget: '   ' });
      expect(result.budget).toBeUndefined();
    });
  });
});
