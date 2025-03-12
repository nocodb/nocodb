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
      sub_type: 'github',
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
    label: 'Repo owner',
    width: 48,
    model: 'config.owner',
    placeholder: 'Repo owner',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Repo owner is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Source',
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Repo name',
    width: 48,
    model: 'config.repo',
    placeholder: 'Repo name',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Repo name is required',
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
