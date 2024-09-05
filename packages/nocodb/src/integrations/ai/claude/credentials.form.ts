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
    category: 'Credentials',
    placeholder: 'Enter your API Key',
    required: true,
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Model',
    width: 100,
    model: 'config.model',
    category: 'Settings',
    options: [
      { value: 'claude-3-5-sonnet-20240620', label: 'Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Opus' },
    ],

    defaultValue: 'claude-3-5-sonnet-20240620',
    required: true,
  },
];
