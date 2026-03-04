import type { ContactMessageData } from '../../domain/models/ContactMessage';
import { ValidationError } from '../../infrastructure/errors/ValidationError';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactMessage(body: unknown): ContactMessageData {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const raw = body as Record<string, unknown>;

  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
  if (!name || name.length < 2 || name.length > 100) {
    throw new ValidationError('Validation failed: name must be between 2 and 100 characters');
  }

  const lastname = typeof raw['lastname'] === 'string' ? raw['lastname'].trim() : '';
  if (!lastname || lastname.length < 2 || lastname.length > 100) {
    throw new ValidationError('Validation failed: lastname must be between 2 and 100 characters');
  }

  const email = typeof raw['email'] === 'string' ? raw['email'].trim() : '';
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new ValidationError('Validation failed: email must be a valid email address');
  }

  const phone = typeof raw['phone'] === 'string' ? raw['phone'].trim() : '';
  if (!phone || phone.length < 6 || phone.length > 20) {
    throw new ValidationError('Validation failed: phone must be between 6 and 20 characters');
  }

  const message = typeof raw['message'] === 'string' ? raw['message'].trim() : '';
  if (!message || message.length < 10 || message.length > 1000) {
    throw new ValidationError('Validation failed: message must be between 10 and 1000 characters');
  }

  return { name, lastname, email, phone, message };
}
