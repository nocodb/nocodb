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
    label: 'Resource Name',
    width: 48,
    model: 'config.resourceName',
    category: 'Credentials',
    placeholder: 'Azure resource name',

    validators: [
      {
        type: 'required',
        message: 'Resource Name is required',
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
    label: 'API Key',
    width: 48,
    model: 'config.apiKey',
    category: 'Credentials',
    placeholder: 'API Key',
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
    category: 'Settings',
    placeholder: 'Allowed Models',
    selectMode: 'multipleWithInput',
    options: [],
    validators: [
      {
        type: 'required',
        message: 'At least one model is required',
      },
    ],
  },
];
