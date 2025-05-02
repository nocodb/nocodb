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
      sub_type: 'linear',
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
    label: 'Team ID',
    width: 100,
    model: 'config.teamId',
    placeholder: 'Team ID',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Team ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include archived issues',
    width: 100,
    model: 'config.includeArchived',
    category: 'Source',
    defaultValue: false,
  },
];
