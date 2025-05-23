import { FormBuilderInputType } from '@noco-integrations/core';
import { AuthType } from '@noco-integrations/core';
import { authUri, clientId, redirectUri, scopes } from './config';
import type { FormDefinition } from '@noco-integrations/core';

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
        type: 'required' as const,
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Auth Type',
    width: 100,
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
        label: 'Basic Auth',
        value: AuthType.Basic,
      },
      {
        label: 'Bearer Token',
        value: AuthType.Bearer, 
      },
      {
        label: 'Custom',
        value: AuthType.Custom,
      },
      ...(redirectUri && clientId
        ? [
            {
              label: 'OAuth2',
              value: AuthType.OAuth,
            },
          ]
        : []),
    ],
    validators: [
      {
        type: 'required' as const,
        message: 'Auth type is required',
      },
    ],
  },
  
  // API Key authentication fields
  {
    type: FormBuilderInputType.Input,
    label: 'API Key',
    width: 100,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your API Key',
    validators: [
      {
        type: 'required' as const,
        message: 'API Key is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  
  // Basic authentication fields
  {
    type: FormBuilderInputType.Input,
    label: 'Username',
    width: 48,
    model: 'config.username',
    category: 'Authentication',
    placeholder: 'Enter your username',
    validators: [
      {
        type: 'required' as const,
        message: 'Username is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Basic,
    },
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Authentication',
    condition: {
      model: 'config.type',
      value: AuthType.Basic,
    },
  },
  {
    type: FormBuilderInputType.Password,
    label: 'Password',
    width: 48,
    model: 'config.password',
    category: 'Authentication',
    placeholder: 'Enter your password',
    validators: [
      {
        type: 'required' as const,
        message: 'Password is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Basic,
    },
  },
  
  // Bearer token authentication fields
  {
    type: FormBuilderInputType.Input,
    label: 'Bearer Token',
    width: 100,
    model: 'config.bearer_token',
    category: 'Authentication',
    placeholder: 'Enter your Bearer Token',
    validators: [
      {
        type: 'required' as const,
        message: 'Bearer Token is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Bearer,
    },
  },
  
  // Custom authentication fields
  {
    type: FormBuilderInputType.Input,
    label: 'Custom Field 1',
    width: 100,
    model: 'config.custom_field1',
    category: 'Authentication',
    placeholder: 'Enter custom field value',
    validators: [
      {
        type: 'required' as const,
        message: 'This field is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.Custom,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Custom Field 2',
    width: 100,
    model: 'config.custom_field2',
    category: 'Authentication',
    placeholder: 'Enter custom field value',
    condition: {
      model: 'config.type',
      value: AuthType.Custom,
    },
  },
  
  // OAuth authentication fields - only shown if OAuth is configured
  ...(redirectUri && clientId
    ? [
        {
          type: FormBuilderInputType.OAuth,
          label: 'OAuth Configuration',
          width: 100,
          model: 'config.oauth.code',
          category: 'Authentication',
          validators: [
            {
              type: 'required' as const,
              message: 'OAuth Configuration is required',
            },
          ],
          condition: {
            model: 'config.type',
            value: AuthType.OAuth,
          },
          oauthMeta: {
            provider: 'Your Service',
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
]; 