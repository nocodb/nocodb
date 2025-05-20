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
    width: 48,
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
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Credentials',
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Organization ID (Optional)',
    width: 48,
    model: 'config.organizationId',
    placeholder: 'Organization ID',
    category: 'Credentials',
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models',
    width: 100,
    model: 'config.models',
    placeholder: 'Allowed models',
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
