import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'GitHub Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'github',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Provider connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Repository Owner',
    width: 48,
    model: 'config.owner',
    placeholder: 'e.g., octocat',
    category: 'Source',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Repository is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Source',
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Repository Name',
    width: 48,
    model: 'config.repo',
    placeholder: 'e.g., Hello-World',
    category: 'Source',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Repo is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed issues',
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
    label: 'Include Pull Requests',
    width: 48,
    model: 'config.includePRs',
    category: 'Source',
    defaultValue: false,
  },
];

export default form;
