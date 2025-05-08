import {
  AuthType,
  FormBuilderInputType,
  FormDefinition,
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
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Auth Type',
    width: 48,
    model: 'config.type',
    category: 'Authentication',
    placeholder: 'Select auth type',
    defaultValue: AuthType.Custom,
    options: [
      {
        label: 'Custom',
        value: AuthType.Custom,
      },
    ],
    validators: [
      {
        type: 'required',
        message: 'Auth type is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Clickhouse Instance URL',
    width: 100,
    model: 'config.host',
    category: 'Authentication',
    placeholder: 'Enter your Clickhouse Instance URL',
    validators: [
      {
        type: 'required',
        message: 'Clickhouse Instance URL is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Custom,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Username',
    width: 100,
    model: 'config.username',
    category: 'Authentication',
    placeholder: 'Enter your username',
    validators: [
      {
        type: 'required',
        message: 'Username is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Custom,
    },
  },
  {
    type: FormBuilderInputType.Password,
    label: 'Password',
    width: 100,
    model: 'config.password',
    category: 'Authentication',
    placeholder: 'Enter your password',
    validators: [
      {
        type: 'required',
        message: 'Password is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Custom,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Database',
    width: 100,
    model: 'config.database',
    category: 'Authentication',
    placeholder: 'Enter your database name',
    validators: [
      {
        type: 'required',
        message: 'Database name is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Custom,
    },
  },
];
