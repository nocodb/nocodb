import { isValidURL } from ".";

describe('isValidURL', () => {
  it('should return true for a valid URL', () => {
    expect(isValidURL('https://www.google.com')).toBe(true);
  });

  it('should return true for a valid URL with a path', () => {
    expect(isValidURL('https://www.google.com/receipts')).toBe(true);
  });

  it('should return true for a valid URL for http with a path', () => {
    expect(isValidURL('http://www.google.com/receipts')).toBe(true);
  });

  it('should return true for a valid URL with a port', () => {
    expect(isValidURL('https://www.google.com:8080')).toBe(true);
  });

  it('should return true for a valid localhost URL', () => {
    expect(isValidURL('http://localhost:8081/receipts')).toBe(true);
  });

  it('should return true for a valid URL with an invalid protocol', () => {
    expect(isValidURL('mailto://user@example.com')).toBe(true);
  });

  it('should return true for a valid URL with an invalid protocol', () => {
    expect(isValidURL('tel://www.google.com')).toBe(true);
  });

  it('should return true for a valid URL with an invalid protocol', () => {
    expect(isValidURL('file://www.google.com')).toBe(true);
  });

  it('should return true for a valid URL with an invalid protocol', () => {
    expect(isValidURL('file://www.google.com')).toBe(true);
  });

  it('should return false for an invalid URL', () => {
    expect(isValidURL('invalid-url')).toBe(false);
  });
  
  it('should return true for a valid URL with an invalid protocol', () => {
    expect(isValidURL('ftp://www.google.com')).toBe(true);
  });
});

