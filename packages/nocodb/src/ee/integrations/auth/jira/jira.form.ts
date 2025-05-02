import { FormBuilderInputType } from 'nocodb-sdk';
import { AuthType } from '~/integrations/auth/auth.helpers';
import {
  clientId,
  redirectUri,
  scopes,
} from '~/integrations/auth/jira/jira.entry';

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
    label: 'Jira Domain',
    width: 100,
    model: 'config.domain',
    category: 'Authentication',
    placeholder: 'e.g., https://your-domain.atlassian.net',
    validators: [
      {
        type: 'required',
        message: 'Jira Domain is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Atlassian Account Email',
    width: 100,
    model: 'config.email',
    category: 'Authentication',
    placeholder: 'Enter your Atlassian account email',
    validators: [
      {
        type: 'required',
        message: 'Email is required',
      },
      {
        type: 'email',
        message: 'Invalid email format',
      },
    ],
    condition: {
      model: 'config.type',
      value: AuthType.ApiKey,
    },
  },
  {
    type: FormBuilderInputType.Input,
    label: 'API Token',
    width: 100,
    model: 'config.token',
    category: 'Authentication',
    placeholder: 'Enter your API Token',
    description:
      'Generate an API token from your Atlassian account settings: Profile > Security > Create and manage API tokens',
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
            provider: 'Jira',
            authUri: `https://auth.atlassian.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
              scopes.join(' '),
            )}&response_type=code&audience=api.atlassian.com&prompt=consent`,
            redirectUri,
            clientId,
            scopes,
          },
        },
      ]
    : []),
];
