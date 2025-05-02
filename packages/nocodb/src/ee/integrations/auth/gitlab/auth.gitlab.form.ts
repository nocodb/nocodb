import { FormBuilderInputType } from 'nocodb-sdk';
import { AuthType } from '../auth.helpers';
import {
  clientId,
  redirectUri,
  scopes,
} from '~/integrations/auth/gitlab/auth.gitlab.entry';

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
        type: 'required',
        message: 'Auth type is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'GitLab Instance URL',
    width: 100,
    model: 'config.baseUrl',
    category: 'Authentication',
    placeholder: 'https://gitlab.com',
    defaultValue: 'https://gitlab.com',
    validators: [
      {
        type: 'required',
        message: 'GitLab Instance URL is required',
      },
      {
        type: 'url',
        message: 'Please enter a valid URL',
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
        type: 'required',
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
          label: 'OAuth Configuration',
          width: 100,
          model: 'config.oauth.code',
          category: 'Authentication',
          validators: [
            {
              type: 'required',
              message: 'OAuth Configuration is required',
            },
          ],
          condition: {
            model: 'config.type',
            value: AuthType.OAuth,
          },
          oauthMeta: {
            provider: 'GitLab',
            authUri: (config) =>
              `${
                config?.baseUrl || 'https://gitlab.com'
              }/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(
                scopes.join(' '),
              )}`,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
