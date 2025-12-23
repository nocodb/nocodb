import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Jira Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'jira-cloud',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Jira connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Project Key',
    width: 48,
    model: 'config.projects',
    placeholder: 'e.g., PROJECT',
    selectMode: 'multiple',
    fetchOptionsKey: 'projects',
    category: 'Source',
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Project(s) is required',
      },
    ],
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
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
    label: 'Include closed issues',
    width: 48,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: true,
  },
  {
    type: FormBuilderInputType.Input,
    label: 'JQL Query',
    width: 100,
    model: 'config.jqlQuery',
    placeholder: 'e.g., project = "PROJECT" AND type = "Bug"',
    category: 'Source',
  },
];

export default form;
