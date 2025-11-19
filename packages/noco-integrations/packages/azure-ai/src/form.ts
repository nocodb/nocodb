import {
  FormBuilderInputType,
  FormBuilderValidatorType,
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
        type: FormBuilderValidatorType.Required,
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Azure OpenAI API key',
    width: 100,
    model: 'config.apiKey',
    placeholder: 'API key',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Azure resource name',
    width: 100,
    model: 'config.resourceName',
    placeholder: 'your-resource-name',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Resource name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API version',
    width: 100,
    model: 'config.apiVersion',
    placeholder: '2024-05-01-preview',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API version is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models (deployment names)',
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
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
