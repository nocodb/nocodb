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
    defaultValue: AuthType.ApiKey,
    options: [
      {
        label: 'Access token',
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
    label: 'Access token',
    span: 24,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your Bitbucket access token',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Access token is required',
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
          model: 'config.oauth.code',
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
            provider: 'Bitbucket',
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
