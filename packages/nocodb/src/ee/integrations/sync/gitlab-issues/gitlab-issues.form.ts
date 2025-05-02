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
      sub_type: 'gitlab',
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
    label: 'Project ID',
    width: 100,
    model: 'config.projectId',
    placeholder: 'GitLab Project ID',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Project ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed issues',
    width: 100,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: false,
  },
];
