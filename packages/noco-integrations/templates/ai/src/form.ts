import {
  FormBuilderInputType,
  type FormDefinition,
} from '@noco-integrations/core';

export const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    width: 100,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    validators: [
      {
        type: 'required' as const,
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 100,
    model: 'config.apiKey',
    placeholder: 'API Key',
    category: 'Credentials',
    validators: [
      {
        type: 'required' as const,
        message: 'API Key is required',
      },
    ],
  },
  // Add additional fields as needed for your AI integration
  // Example: API endpoint, API version, etc.
  {
    type: FormBuilderInputType.Select,
    label: 'Models',
    width: 100,
    model: 'config.models',
    placeholder: 'Allowed models',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    options: [
      { value: 'model-id-1', label: 'Model Name 1' },
      { value: 'model-id-2', label: 'Model Name 2' },
      { value: 'model-id-3', label: 'Model Name 3' },
    ],
    defaultValue: ['model-id-1'],
    validators: [
      {
        type: 'required' as const,
        message: 'At least one model is required',
      },
    ],
  },
]; 