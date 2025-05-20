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
    label: 'Azure OpenAI API Key',
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
  {
    type: FormBuilderInputType.Input,
    label: 'Azure Resource Name',
    width: 100,
    model: 'config.resourceName',
    placeholder: 'your-resource-name',
    category: 'Credentials',
    validators: [
      {
        type: 'required' as const,
        message: 'Resource Name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Version',
    width: 100,
    model: 'config.apiVersion',
    placeholder: '2024-05-01-preview',
    category: 'Credentials',
    validators: [
      {
        type: 'required' as const,
        message: 'API Version is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models (Deployment Names)',
    width: 100,
    model: 'config.models',
    placeholder: 'Allowed models (deployment names)',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    options: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'o3', label: 'o3' },
      { value: 'o4-mini', label: 'o4-mini' },
    ],
    defaultValue: ['gpt-4o'],
    validators: [
      {
        type: 'required' as const,
        message: 'At least one model is required',
      },
    ],
  },
]; 