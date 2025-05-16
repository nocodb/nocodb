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
  {
    type: FormBuilderInputType.Input,
    label: 'Jira Cloud URL',
    width: 100,
    model: 'config.jira_url',
    category: 'Authentication',
    placeholder: 'https://your-domain.atlassian.net',
    validators: [
      {
        type: 'required' as const,
        message: 'Jira Cloud URL is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Token',
    width: 100,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your API Token',
    validators: [
      {
        type: 'required' as const,
        message: 'API Token is required',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Email Address',
    width: 100,
    model: 'config.email',
    category: 'Authentication',
    placeholder: 'Enter your Jira email address',
    validators: [
      {
        type: 'required' as const,
        message: 'Email address is required',
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
            provider: 'Jira',
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
