import { FormBuilderInputType } from 'nocodb-sdk';
import { AuthType } from '~/integrations/auth/auth.helpers';

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
    type: FormBuilderInputType.Select,
    label: 'Auth Type',
    width: 48,
    model: 'config.type',
    category: 'Authentication',
    placeholder: 'Select auth type',
    defaultValue: AuthType.ApiKey,
    options: [
      {
        label: 'API Key',
        value: AuthType.ApiKey,
      },
      {
        label: 'Basic',
        value: AuthType.Basic,
      },
      {
        label: 'Bearer',
        value: AuthType.Bearer,
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
    label: 'Base URL',
    width: 100,
    model: 'config.baseUrl',
    category: 'Authentication',
    placeholder: 'Enter your Base URL',
    validators: [
      {
        type: 'required',
        message: 'Base URL is required',
      },
    ],
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
      value: AuthType.Basic,
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
      value: AuthType.Basic,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Header Name',
    width: 100,
    model: 'config.headerName',
    category: 'Authentication',
    placeholder: 'Enter your header name',
    validators: [
      {
        type: 'required',
        message: 'Header name is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 100,
    model: 'config.apiKey',
    category: 'Authentication',
    placeholder: 'Enter your API key',
    validators: [
      {
        type: 'required',
        message: 'API key is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Bearer Token',
    width: 100,
    model: 'config.bearerToken',
    category: 'Authentication',
    placeholder: 'Enter your bearer token',
    validators: [
      {
        type: 'required',
        message: 'Bearer token is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Bearer,
    },
  },
];
