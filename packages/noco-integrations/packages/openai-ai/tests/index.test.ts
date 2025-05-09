import { describe, it, expect } from 'vitest';
import { IntegrationType } from '@noco-integrations/core';
import integration from '../src/index';
import { OpenAIIntegration } from '../src/integration';
import { form } from '../src/form';
import { manifest } from '../src/manifest';

describe('OpenAI Integration Entry', () => {
  it('should export the correct integration type', () => {
    expect(integration.type).toBe(IntegrationType.Ai);
  });

  it('should export the correct sub_type', () => {
    expect(integration.sub_type).toBe('openai');
  });

  it('should export the OpenAIIntegration wrapper', () => {
    expect(integration.wrapper).toBe(OpenAIIntegration);
  });

  it('should export the form definition', () => {
    expect(integration.form).toBe(form);
    // Verify some key form elements exist
    expect(integration.form.find(item => item.model === 'config.apiKey')).toBeTruthy();
    expect(integration.form.find(item => item.model === 'config.models')).toBeTruthy();
  });

  it('should export the manifest', () => {
    expect(integration.manifest).toBe(manifest);
    expect(integration.manifest.title).toBe('OpenAI');
    expect(integration.manifest.icon).toBe('openai');
    expect(typeof integration.manifest.version).toBe('string');
  });
}); 