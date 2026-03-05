import { ProjectRequest, ProjectRequestData } from '../../../../src/domain/models/ProjectRequest';

const validData: ProjectRequestData = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  projectType: 'Website',
  description: 'I need a new e-commerce site.',
};

describe('ProjectRequest', () => {
  it('should store all required fields from constructor', () => {
    const req = new ProjectRequest('test-id', validData);

    expect(req.id).toBe('test-id');
    expect(req.name).toBe('Jane Doe');
    expect(req.email).toBe('jane@example.com');
    expect(req.projectType).toBe('Website');
    expect(req.description).toBe('I need a new e-commerce site.');
  });

  it('should store undefined budget when not provided', () => {
    const req = new ProjectRequest('test-id', validData);
    expect(req.budget).toBeUndefined();
  });

  it('should store budget when provided', () => {
    const req = new ProjectRequest('test-id', { ...validData, budget: '5000-10000' });
    expect(req.budget).toBe('5000-10000');
  });

  it('should set timestamp to a number on construction', () => {
    const before = Date.now();
    const req = new ProjectRequest('test-id', validData);
    const after = Date.now();

    expect(typeof req.timestamp).toBe('number');
    expect(req.timestamp).toBeGreaterThanOrEqual(before);
    expect(req.timestamp).toBeLessThanOrEqual(after);
  });

  describe('toQueuePayload', () => {
    it('should return type "project_request"', () => {
      const req = new ProjectRequest('test-id', validData);
      const payload = req.toQueuePayload();
      expect(payload.type).toBe('project_request');
    });

    it('should include all fields in data', () => {
      const req = new ProjectRequest('test-id', { ...validData, budget: '1000-5000' });
      const payload = req.toQueuePayload();
      const data = payload.data as Record<string, unknown>;

      expect(data.id).toBe('test-id');
      expect(data.name).toBe('Jane Doe');
      expect(data.email).toBe('jane@example.com');
      expect(data.projectType).toBe('Website');
      expect(data.description).toBe('I need a new e-commerce site.');
      expect(data.budget).toBe('1000-5000');
      expect(typeof data.timestamp).toBe('number');
    });

    it('should include undefined budget in data when not provided', () => {
      const req = new ProjectRequest('test-id', validData);
      const payload = req.toQueuePayload();
      const data = payload.data as Record<string, unknown>;
      expect(data.budget).toBeUndefined();
    });
  });
});
