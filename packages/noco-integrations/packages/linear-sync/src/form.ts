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
    label: 'Linear Connection',
    width: 100,
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
    label: 'Team Key',
    width: 100,
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
    label: 'Include Canceled Issues',
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    width: 48,
    model: 'config.includeCanceled',
    category: 'Options',
    defaultValue: false,
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include Completed Issues',
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    width: 48,
    model: 'config.includeCompleted',
    category: 'Options',
    defaultValue: true,
  },
];

export default form;