import { FormBuilderInputType } from 'nocodb-sdk';
import { AuthType } from '~/integrations/auth/auth.helpers';
import {
  clientId,
  redirectUri,
  scopes,
} from '~/integrations/auth/zendesk/entry';

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
    type: FormBuilderInputType.Input,
    label: 'Subdomain',
    width: 100,
    model: 'config.subdomain',
    placeholder: 'your-subdomain',
    category: 'Authentication',
    validators: [
      {
        type: 'required',
        message: 'Zendesk subdomain is required',
      },
    ],
    help: 'Your Zendesk subdomain (e.g., if your URL is https://mycompany.zendesk.com, enter "mycompany")',
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
    label: 'Email',
    width: 100,
    model: 'config.email',
    category: 'Authentication',
    placeholder: 'Enter your Zendesk email',
    validators: [
      {
        type: 'required',
        message: 'Email is required for API token authentication',
      },
      {
        type: 'email',
        message: 'Please enter a valid email',
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
            provider: 'Zendesk',
            authUri: (subdomain: string) => 
              `https://${subdomain}.zendesk.com/oauth/authorizations/new?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(
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
