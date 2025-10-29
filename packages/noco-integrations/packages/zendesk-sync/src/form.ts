import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Zendesk Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'zendesk',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Zendesk connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed tickets',
    width: 48,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: true,
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Source',
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include archived tickets',
    width: 48,
    model: 'config.includeArchived',
    category: 'Source',
    defaultValue: false,
  },
];

export default form;
