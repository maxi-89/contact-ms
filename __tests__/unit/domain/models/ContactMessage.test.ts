import { ContactMessage } from '../../../../src/domain/models/ContactMessage';
import type { ContactMessageData } from '../../../../src/domain/models/ContactMessage';

const validData: ContactMessageData = {
  name: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  phone: '+1-555-0100',
  message: 'Hello, I would like to get in touch.',
};

describe('ContactMessage', () => {
  describe('constructor', () => {
    it('should set all fields from ContactMessageData', () => {
      const msg = new ContactMessage('id-123', validData);
      expect(msg.name).toBe(validData.name);
      expect(msg.lastname).toBe(validData.lastname);
      expect(msg.email).toBe(validData.email);
      expect(msg.phone).toBe(validData.phone);
      expect(msg.message).toBe(validData.message);
    });

    it('should set id from the first argument', () => {
      const msg = new ContactMessage('my-unique-id', validData);
      expect(msg.id).toBe('my-unique-id');
    });

    it('should set timestamp to Date.now() at construction time', () => {
      jest.useFakeTimers();
      jest.setSystemTime(1_700_000_000_000);

      const msg = new ContactMessage('id-123', validData);
      expect(msg.timestamp).toBe(1_700_000_000_000);

      jest.useRealTimers();
    });
  });

  describe('toQueuePayload()', () => {
    it('should return an object with type "contact_message"', () => {
      const msg = new ContactMessage('id-123', validData);
      expect(msg.toQueuePayload().type).toBe('contact_message');
    });

    it('should include all entity fields nested under "data"', () => {
      const msg = new ContactMessage('id-123', validData);
      const payload = msg.toQueuePayload();
      const data = payload.data as Record<string, unknown>;
      expect(data['name']).toBe(validData.name);
      expect(data['lastname']).toBe(validData.lastname);
      expect(data['email']).toBe(validData.email);
      expect(data['phone']).toBe(validData.phone);
      expect(data['message']).toBe(validData.message);
    });

    it('should include id and timestamp in data', () => {
      jest.useFakeTimers();
      jest.setSystemTime(1_700_000_000_000);

      const msg = new ContactMessage('id-123', validData);
      const data = msg.toQueuePayload().data as Record<string, unknown>;
      expect(data['id']).toBe('id-123');
      expect(data['timestamp']).toBe(1_700_000_000_000);

      jest.useRealTimers();
    });
  });
});
