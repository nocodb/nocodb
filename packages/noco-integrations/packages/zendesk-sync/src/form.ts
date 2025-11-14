import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    width: 100,
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
    type: FormBuilderInputType.SelectIntegration,
    label: 'Zendesk Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
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
    type: FormBuilderInputType.Checkbox,
    label: 'Include Closed Tickets',
    description: 'Sync both open and closed tickets to maintain a complete record of project history and resolutions.',
    width: 100,
    model: 'config.includeClosed',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;
