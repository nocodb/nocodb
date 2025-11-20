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
    label: 'Zoho region',
    span: 24,
    model: 'config.region',
    category: 'General',
    placeholder: 'Select your Zoho data center region',
    defaultValue: 'com',
    options: [
      {
        label: 'United States (.com)',
        value: 'com',
      },
      {
        label: 'Europe (.eu)',
        value: 'eu',
      },
      {
        label: 'India (.in)',
        value: 'in',
      },
      {
        label: 'Australia (.com.au)',
        value: 'com.au',
      },
      {
        label: 'Japan (.jp)',
        value: 'jp',
      },
      {
        label: 'China (.com.cn)',
        value: 'com.cn',
      },
      {
        label: 'UK (.uk)',
        value: 'uk',
      },
      {
        label: 'SA (.sa)',
        value: 'sa',
      },
    ],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Zoho region is required',
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
    defaultValue: AuthType.OAuth,
    options: [
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
            provider: 'Zoho',
            authUri,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
