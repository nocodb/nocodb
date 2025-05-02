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
    label: 'Region',
    width: 48,
    model: 'config.region',
    category: 'Credentials',
    placeholder: 'AWS Region',

    validators: [
      {
        type: 'required',
        message: 'Region is required',
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
    label: 'Access Key ID',
    width: 48,
    model: 'config.accessKeyId',
    category: 'Credentials',
    placeholder: 'AWS Access Key ID',

    validators: [
      {
        type: 'required',
        message: 'Access Key ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Secret Access Key',
    width: 48,
    model: 'config.secretAccessKey',
    category: 'Credentials',
    placeholder: 'AWS Secret Access Key',

    validators: [
      {
        type: 'required',
        message: 'Secret Access Key is required',
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
    label: 'Session Token (Optional)',
    width: 48,
    model: 'config.sessionToken',
    category: 'Credentials',
    placeholder: 'AWS Session Token',
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Models',
    width: 100,
    model: 'config.models',
    category: 'Settings',
    placeholder: 'Allowed Models',
    selectMode: 'multipleWithInput',
    options: [
      {
        value: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        label: 'claude-3-5-sonnet-20241022-v2',
      },
      {
        value: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        label: 'claude-3-5-sonnet-20240620-v1',
      },
    ],
    validators: [
      {
        type: 'required',
        message: 'At least one model is required',
      },
    ],
  },
];
