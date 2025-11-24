import {
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import { AuthType } from '@noco-integrations/core';
import { authUri, clientId, redirectUri, scopes } from './config';
import type { FormDefinition } from '@noco-integrations/core';

export const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    span: 24,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Zendesk subdomain',
    span: 24,
    model: 'config.subdomain',
    category: 'General',
    placeholder: 'e.g., yourcompany (from yourcompany.zendesk.com)',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Zendesk subdomain is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Auth type',
    span: 12,
    model: 'config.type',
    category: 'Authentication',
    placeholder: 'Select auth type',
    defaultValue: redirectUri && clientId ? AuthType.OAuth: AuthType.ApiKey,
    options: [
      {
        label: 'API key',
        value: AuthType.ApiKey,
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
        type: FormBuilderValidatorType.Required,
        message: 'Auth type is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Email address',
    span: 24,
    model: 'config.email',
    category: 'Authentication',
    placeholder: 'Enter your Zendesk email address',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Email is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API token',
    span: 24,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your API Token',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API Token is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  ...(redirectUri && clientId
    ? [
        {
          type: FormBuilderInputType.OAuth,
          label: 'OAuth configuration',
          span: 24,
          model: 'config.oauth',
          category: 'Authentication',
          validators: [
            {
              type: FormBuilderValidatorType.Required,
              message: 'OAuth configuration is required',
            },
          ],
          condition: {
            model: 'config.type',
            value: AuthType.OAuth,
          },
          oauthMeta: {
            provider: 'Zendesk',
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
