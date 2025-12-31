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
    label: 'API base URL',
    span: 24,
    model: 'config.baseURL',
    placeholder: 'http://localhost:8080/v1',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API base URL is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API key',
    span: 24,
    model: 'config.apiKey',
    placeholder: 'API key (optional for some services)',
    category: 'Credentials',
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models',
    span: 24,
    model: 'config.models',
    placeholder: 'Allowed models',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    fetchOptionsKey: 'models',
    defaultValue: ['llama-3-70b-8192'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
