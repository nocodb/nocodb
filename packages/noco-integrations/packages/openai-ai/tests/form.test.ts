import { describe, it, expect } from 'vitest';
import { form } from '../src/form';
import { FormBuilderInputType } from '@noco-integrations/core';

describe('OpenAI Form Definition', () => {
  it('should contain all required form fields', () => {
    // Check that we have the integration name field
    const titleField = form.find(field => field.model === 'title');
    expect(titleField).toBeTruthy();
    expect(titleField?.type).toBe(FormBuilderInputType.Input);
    expect(titleField?.label).toBe('Integration name');

    // Check that we have the API Key field
    const apiKeyField = form.find(field => field.model === 'config.apiKey');
    expect(apiKeyField).toBeTruthy();
    expect(apiKeyField?.type).toBe(FormBuilderInputType.Input);
    expect(apiKeyField?.label).toBe('API Key');
    expect(apiKeyField?.validators).toContainEqual(expect.objectContaining({
      type: 'required',
    }));

    // Check that we have the Organization ID field
    const organizationIdField = form.find(field => field.model === 'config.organizationId');
    expect(organizationIdField).toBeTruthy();
    expect(organizationIdField?.type).toBe(FormBuilderInputType.Input);
    expect(organizationIdField?.label).toBe('Organization ID (Optional)');

    // Check that we have the Models field
    const modelsField = form.find(field => field.model === 'config.models');
    expect(modelsField).toBeTruthy();
    expect(modelsField?.type).toBe(FormBuilderInputType.Select);
    expect(modelsField?.label).toBe('Models');
    expect(modelsField?.validators).toContainEqual(expect.objectContaining({
      type: 'required',
    }));
  });

  it('should contain the expected model options', () => {
    const modelsField = form.find(field => field.model === 'config.models');
    
    // Check that the field has options
    expect(modelsField?.options).toBeTruthy();
    
    // Check for specific model options
    const options = modelsField?.options as { value: string; label: string }[];
    expect(options).toContainEqual({ value: 'gpt-4o', label: 'GPT-4o' });
    expect(options).toContainEqual({ value: 'gpt-4o-mini', label: 'GPT-4o Mini' });
    expect(options).toContainEqual({ value: 'gpt-4-turbo', label: 'GPT-4 Turbo' });
    expect(options).toContainEqual({ value: 'gpt-4', label: 'GPT-4' });
    expect(options).toContainEqual({ value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' });
  });

  it('should have proper field widths and layout', () => {
    // Check that title field is full width
    const titleField = form.find(field => field.model === 'title');
    expect(titleField?.width).toBe(100);

    // Check that API Key is not full width (allowing for layout)
    const apiKeyField = form.find(field => field.model === 'config.apiKey');
    expect(apiKeyField?.width).toBeLessThan(100);

    // Check that models field is full width
    const modelsField = form.find(field => field.model === 'config.models');
    expect(modelsField?.width).toBe(100);
  });
}); 