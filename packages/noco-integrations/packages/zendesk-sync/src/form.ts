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
    type: FormBuilderInputType.SelectIntegration,
    label: 'Zendesk connection',
    span: 24,
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
    label: 'Include closed tickets',
    description: 'Sync both open and closed tickets to maintain a complete record of project history and resolutions.',
    span: 24,
    model: 'config.includeClosed',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;
