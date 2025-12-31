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
    label: 'API key',
    span: 24,
    model: 'config.apiKey',
    placeholder: 'API key',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API Key is required',
      },
    ],
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
    defaultValue: ['deepseek-chat'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
