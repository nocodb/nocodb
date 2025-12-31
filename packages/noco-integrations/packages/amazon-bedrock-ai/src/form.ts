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
    label: 'AWS access key ID',
    span: 12,
    model: 'config.accessKeyId',
    placeholder: 'Access key ID',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Access key ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'AWS secret access key',
    span: 12,
    model: 'config.secretAccessKey',
    placeholder: 'Secret access key',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Secret access key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'AWS region',
    span: 24,
    model: 'config.region',
    placeholder: 'us-east-1',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'AWS region is required',
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
    defaultValue: ['anthropic.claude-opus-4-5-20251101-v1:0'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
