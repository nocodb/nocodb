import { FormBuilderInputType } from 'nocodb-sdk';

export default [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    width: 100,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    required: true,
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 50,
    model: 'config.apiKey',
    placeholder: 'API Key',
    category: 'Credentials',
    required: true,
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Organization ID (Optional)',
    width: 50,
    model: 'config.organizationId',
    placeholder: 'Organization ID',
    category: 'Credentials',
    required: false,
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Model',
    width: 100,
    model: 'config.model',
    placeholder: 'Model',
    category: 'Settings',
    options: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'gpt-3.5', label: 'GPT-3.5' },
      { value: 'gpt-3', label: 'GPT-3' },
    ],
    defaultValue: 'gpt-4o',
    required: true,
  },
];
