import { FormBuilderInputType } from 'nocodb-sdk';

export default [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    width: 100,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    validators: [
      {
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 100,
    model: 'config.apiKey',
    placeholder: 'API Key',
    category: 'Credentials',
    validators: [
      {
        type: 'required',
        message: 'API Key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models',
    width: 100,
    model: 'config.models',
    placeholder: 'Allowed models',
    helpText: 'Select models allowed for this integration',
    category: 'Settings',
    selectMode: 'multipleWithInput',
    options: [
      { value: 'llama-3.1-70b-versatile', label: 'llama-3.1-70b-versatile' },
      { value: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' },
    ],
    defaultValue: 'llama-3.1-70b-versatile',
    validators: [
      {
        type: 'required',
        message: 'At least one model is required',
      },
    ],
  },
];
