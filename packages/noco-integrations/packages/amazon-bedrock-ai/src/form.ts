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
    label: 'AWS Access Key ID',
    width: 48,
    model: 'config.accessKeyId',
    placeholder: 'Access Key ID',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Access Key ID is required',
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
    label: 'AWS Secret Access Key',
    width: 48,
    model: 'config.secretAccessKey',
    placeholder: 'Secret Access Key',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Secret Access Key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'AWS Region',
    width: 100,
    model: 'config.region',
    placeholder: 'us-east-1',
    category: 'Credentials',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'AWS Region is required',
      },
    ],
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
      { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
      { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
      { value: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
      {
        value: 'amazon.titan-text-express-v1',
        label: 'Amazon Titan Text Express',
      },
      {
        value: 'anthropic.claude-3-sonnet-20240229-v1:0',
        label: 'Claude 3 Sonnet',
      },
      {
        value: 'anthropic.claude-3-haiku-20240307-v1:0',
        label: 'Claude 3 Haiku',
      },
      {
        value: 'anthropic.claude-3-opus-20240229-v1:0',
        label: 'Claude 3 Opus',
      },
      { value: 'meta.llama3-70b-instruct-v1:0', label: 'Llama 3 70B' },
      { value: 'meta.llama3-8b-instruct-v1:0', label: 'Llama 3 8B' },
      { value: 'mistral.mistral-7b-instruct-v0:2', label: 'Mistral 7B' },
      { value: 'mistral.mixtral-8x7b-instruct-v0:1', label: 'Mixtral 8x7B' },
    ],
    defaultValue: ['amazon.nova-pro-v1:0'],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one model is required',
      },
    ],
  },
];
