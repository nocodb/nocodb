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
    type: FormBuilderInputType.Switch,
    label: 'Include closed tickets',
    width: 100,
    model: 'config.includeClosed',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;
