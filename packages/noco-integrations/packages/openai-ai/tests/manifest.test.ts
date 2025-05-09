import { describe, it, expect } from 'vitest';
import { manifest } from '../src/manifest';

describe('OpenAI Manifest', () => {
  it('should have the correct title', () => {
    expect(manifest.title).toBe('OpenAI');
  });

  it('should have the correct icon', () => {
    expect(manifest.icon).toBe('openai');
  });

  it('should have a valid version', () => {
    expect(manifest.version).toBeTruthy();
    expect(typeof manifest.version).toBe('string');
    
    // Check that it follows semver pattern (x.y.z)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    expect(versionRegex.test(manifest.version)).toBe(true);
  });

  it('should have a description', () => {
    expect(manifest.description).toBeTruthy();
    expect(typeof manifest.description).toBe('string');
  });

  it('should have an author', () => {
    expect(manifest.author).toBeTruthy();
    expect(typeof manifest.author).toBe('string');
    expect(manifest.author).toBe('NocoDB');
  });
}); 