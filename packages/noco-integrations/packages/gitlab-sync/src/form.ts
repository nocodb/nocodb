import {
  FormBuilderInputType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'GitLab Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'gitlab',
    },
    validators: [
      {
        type: 'required' as const,
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
    category: 'Source',
    validators: [
      {
        type: 'required' as const,
        message: 'Project ID is required',
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
    label: 'Include Merge Requests',
    width: 48,
    model: 'config.includeMRs',
    category: 'Source',
    defaultValue: false,
  },
];

export default form;
