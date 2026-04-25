import {
  AuthType,
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import { authUri, clientId, redirectUri, scopes } from './config';
import type { FormDefinition } from '@noco-integrations/core';

export const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    span: 24,
    model: 'title',
    placeholder: 'e.g. Mailchimp Production',
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
    span: [24, 12],
    model: 'config.type',
    category: 'Authentication',
    placeholder: 'Select auth type',
    defaultValue: redirectUri && clientId ? AuthType.OAuth : AuthType.ApiKey,
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
        type: FormBuilderValidatorType.Required,
        message: 'Auth type is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Password,
    label: 'API Key',
    model: 'config.apiKey',
    span: 24,
    category: 'Authentication',
    placeholder: 'Enter your Mailchimp API key (e.g. abc123def-us21)',
    helpText:
      'Found in Mailchimp > Account & Billing > Extras > API keys. The server prefix is extracted automatically from the key.',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'API key is required',
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
              type: FormBuilderValidatorType.Required as const,
              message: 'OAuth configuration is required',
            },
          ],
          condition: {
            model: 'config.type',
            value: AuthType.OAuth,
          },
          oauthMeta: {
            provider: 'Mailchimp',
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
  {
    type: FormBuilderInputType.Password,
    label: 'Mandrill API key',
    model: 'config.mandrillApiKey',
    span: 24,
    category: 'Transactional Email',
    placeholder: '••••••••',
    helpText:
      'Optional. Required for sending transactional emails. Found in Mailchimp > Transactional > Settings.',
  },
];
