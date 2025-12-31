import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
} from '@noco-integrations/core';

export const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    span: 24,
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
    span: 24,
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
    span: 24,
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
    span: 24,
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
    span: 24,
    model: 'config.models',
    placeholder: 'Allowed models (deployment names)',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    fetchOptionsKey: 'models',
    defaultValue: ['gpt-5.2'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
