import {
  FormBuilderInputType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Sync name',
    width: 100,
    model: 'title',
    placeholder: 'Enter a name for this sync',
    category: 'General',
    validators: [
      {
        type: 'required' as const,
        message: 'Sync name is required',
      },
    ],
  },
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
        type: 'required' as const,
        message: 'GitHub connection is required',
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
        type: 'required' as const,
        message: 'Repository owner is required',
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
        type: 'required' as const,
        message: 'Repository name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include closed issues',
    width: 100,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: false,
  },
];

export default form;
