import type { ProjectRequestData } from '../../domain/models/ProjectRequest';
import { ValidationError } from '../../infrastructure/errors/ValidationError';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProjectRequest(body: unknown): ProjectRequestData {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const raw = body as Record<string, unknown>;

  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
  if (!name || name.length < 2 || name.length > 100) {
    throw new ValidationError('Validation failed: name must be between 2 and 100 characters');
  }

  const email = typeof raw['email'] === 'string' ? raw['email'].trim() : '';
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new ValidationError('Validation failed: email must be a valid email address');
  }

  const projectType = typeof raw['projectType'] === 'string' ? raw['projectType'].trim() : '';
  if (!projectType || projectType.length < 2 || projectType.length > 100) {
    throw new ValidationError('Validation failed: projectType must be between 2 and 100 characters');
  }

  const description = typeof raw['description'] === 'string' ? raw['description'].trim() : '';
  if (!description || description.length < 10 || description.length > 2000) {
    throw new ValidationError('Validation failed: description must be between 10 and 2000 characters');
  }

  const rawBudget = typeof raw['budget'] === 'string' ? raw['budget'].trim() : '';
  let budget: string | undefined;
  if (rawBudget) {
    if (rawBudget.length > 100) {
      throw new ValidationError('Validation failed: budget must be at most 100 characters');
    }
    budget = rawBudget;
  }

  return { name, email, projectType, description, budget };
}
