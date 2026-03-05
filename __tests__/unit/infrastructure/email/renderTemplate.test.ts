import fs from 'fs';
import { renderTemplate } from '../../../../src/infrastructure/email/renderTemplate';

jest.mock('fs');

const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('renderTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should replace a single {{variable}} in the template', () => {
    mockReadFileSync.mockReturnValue('<p>{{name}}</p>');
    const result = renderTemplate('/template.html', { name: 'Jane' });
    expect(result).toBe('<p>Jane</p>');
  });

  it('should replace multiple {{variables}} in one pass', () => {
    mockReadFileSync.mockReturnValue('<p>{{name}} - {{email}}</p>');
    const result = renderTemplate('/template.html', { name: 'Jane', email: 'jane@example.com' });
    expect(result).toBe('<p>Jane - jane@example.com</p>');
  });

  it('should replace the same variable appearing multiple times', () => {
    mockReadFileSync.mockReturnValue('<a href="{{email}}">{{email}}</a>');
    const result = renderTemplate('/template.html', { email: 'jane@example.com' });
    expect(result).toBe('<a href="jane@example.com">jane@example.com</a>');
  });

  it('should leave unreferenced {{variables}} untouched', () => {
    mockReadFileSync.mockReturnValue('<p>{{name}} {{unknown}}</p>');
    const result = renderTemplate('/template.html', { name: 'Jane' });
    expect(result).toBe('<p>Jane {{unknown}}</p>');
  });

  it('should return the template unchanged when variables map is empty', () => {
    mockReadFileSync.mockReturnValue('<p>{{name}}</p>');
    const result = renderTemplate('/template.html', {});
    expect(result).toBe('<p>{{name}}</p>');
  });

  it('should throw when the template file does not exist', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    expect(() => renderTemplate('/nonexistent.html', { name: 'Jane' })).toThrow(
      'ENOENT: no such file or directory',
    );
  });
});
