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
    label: 'GitLab Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'gitlab',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'GitLab connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Project ID',
    width: 100,
    model: 'config.projectId',
    placeholder: 'e.g., 123456 or group/project-name',
    category: 'General',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Project ID is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed issues',
    width: 48,
    model: 'config.includeClosed',
    category: 'Options',
    defaultValue: true,
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Options',
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include Merge Requests',
    width: 48,
    model: 'config.includeMRs',
    category: 'Options',
    defaultValue: false,
  },
];

export default form;
