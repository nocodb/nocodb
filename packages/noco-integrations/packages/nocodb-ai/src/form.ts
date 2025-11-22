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
    span: 12,
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
    type: FormBuilderInputType.Select,
    label: 'Models',
    span: 24,
    model: 'config.models',
    placeholder: 'Allowed models',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    options: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    defaultValue: ['high'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
