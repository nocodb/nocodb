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
    label: 'GitLab connection',
    span: 24,
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
    span: 24,
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
    type: FormBuilderInputType.Checkbox,
    label: 'Include closed issues',
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    span: 12,
    model: 'config.includeClosed',
    category: 'Options',
    defaultValue: true,
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include merge requests',
    description: "Sync merge requests along with issues to track code changes, reviews, and merges within your workspace.",
    span: 12,
    model: 'config.includeMRs',
    category: 'Options',
    defaultValue: false,
  },
];

export default form;
