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
    type: FormBuilderInputType.Select,
    label: 'Auth type',
    span: 12,
    model: 'config.type',
    category: 'Authentication',
    placeholder: 'Select auth type',
    defaultValue: redirectUri && clientId ? AuthType.OAuth : AuthType.ApiKey,
    options: [
      {
        label: 'API key', // Or 'Personal Access Token' - adjust based on your provider
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
    label: 'API token', // Adjust label based on provider (e.g., 'Personal Access Token', 'API Key')
    span: 24,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your API token',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API token is required',
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
            provider: 'Provider Name', // TODO: Replace with your provider name
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
