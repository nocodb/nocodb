import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Linear Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
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
    width: 48,
    model: 'config.teamKey',
    placeholder: 'e.g., ENG',
    category: 'Source',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Team key is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Source',
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include canceled issues',
    width: 48,
    model: 'config.includeCanceled',
    category: 'Source',
    defaultValue: false,
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include completed issues',
    width: 48,
    model: 'config.includeCompleted',
    category: 'Source',
    defaultValue: true,
  },
];

export default form;
