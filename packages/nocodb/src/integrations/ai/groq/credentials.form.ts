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
    width: 100,
    model: 'config.apiKey',
    placeholder: 'API Key',
    category: 'Credentials',
    required: true,
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Model',
    width: 100,
    model: 'config.model',
    placeholder: 'Model',
    category: 'Settings',
    options: [
      { value: 'llama-3.1-70b-versatile', label: 'llama-3.1-70b-versatile' },
      { value: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' },
    ],
    defaultValue: 'llama-3.1-70b-versatile',
    required: true,
  },
];
