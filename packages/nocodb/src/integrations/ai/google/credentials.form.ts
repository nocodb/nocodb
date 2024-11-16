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
    category: 'Credentials',
    placeholder: 'Please enter your API Key',

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
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    defaultValue: ['gemini-1.5-pro-latest'],
    validators: [
      {
        type: 'required',
        message: 'At least one model is required',
      },
    ],
  },
];
