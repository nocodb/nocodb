import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Asana Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'asana',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Asana connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Project ID',
    width: 100,
    model: 'config.projectId',
    placeholder: 'e.g., 1234567890',
    category: 'Source',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Project ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include completed tasks',
    width: 48,
    model: 'config.includeCompleted',
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
    label: 'Include subtasks',
    width: 48,
    model: 'config.includeSubtasks',
    category: 'Source',
    defaultValue: true,
  },
];

export default form;
