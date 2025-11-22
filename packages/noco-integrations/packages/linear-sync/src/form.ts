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
    label: 'Linear connection',
    span: 24,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'linear',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Linear connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Team key',
    span: 24,
    model: 'config.teamKey',
    placeholder: 'e.g., ENG',
    category: 'General',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Team key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include canceled issues',
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    span: 12,
    model: 'config.includeCanceled',
    category: 'Options',
    defaultValue: false,
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include completed issues',
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    span: 12,
    model: 'config.includeCompleted',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;