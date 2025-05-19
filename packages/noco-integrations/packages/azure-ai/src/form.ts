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
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4-32k', label: 'GPT-4 32K' },
      { value: 'gpt-35-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'gpt-35-turbo-16k', label: 'GPT-3.5 Turbo 16K' },
    ],
    defaultValue: ['gpt-4'],
    validators: [
      {
        type: 'required' as const,
        message: 'At least one model is required',
      },
    ],
  },
]; 