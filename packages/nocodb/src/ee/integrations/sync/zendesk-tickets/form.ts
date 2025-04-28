import { FormBuilderInputType, IntegrationsType } from 'nocodb-sdk';

export default [
  {
    type: FormBuilderInputType.Input,
    label: 'Sync name',
    width: 100,
    model: 'title',
    placeholder: 'Sync name',
    category: 'General',
    validators: [
      {
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Auth Provider',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationsType.Auth,
      sub_type: 'zendesk',
    },
    validators: [
      {
        type: 'required',
        message: 'Auth Provider is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Subdomain',
    width: 100,
    model: 'config.subdomain',
    placeholder: 'your-subdomain',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Zendesk subdomain is required',
      },
    ],
    help: 'Your Zendesk subdomain (e.g., if your URL is https://mycompany.zendesk.com, enter "mycompany")',
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed tickets',
    width: 100,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: false,
  },
];
