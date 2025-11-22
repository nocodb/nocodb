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
    options: [
      { value: 'deepseek-v3', label: 'DeepSeek v3' },
      { value: 'deepseek-r1', label: 'DeepSeek R1' },
    ],
    defaultValue: ['deepseek-v3'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
