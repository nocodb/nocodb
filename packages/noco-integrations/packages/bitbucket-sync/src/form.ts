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
    label: 'Bitbucket connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'bitbucket',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'Provider connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Select one or more repositories',
    width: 100,
    model: 'config.repos',
    category: 'General',
    placeholder: 'e.g., workspace/repository',
    options: [],
    fetchOptionsKey: 'repos',
    selectMode: 'multiple',
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
      },
    ],
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'At least one repository is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include closed issues',
    width: 48,
    model: 'config.includeClosed',
    category: 'Options',
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    defaultValue: true,
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
      },
    ],
  },
  {
    type: FormBuilderInputType.Checkbox,
    label: 'Include pull requests',
    width: 48,
    model: 'config.includePRs',
    description: "Sync pull requests along with issues to track code changes, reviews, and merges within your workspace.",
    category: 'Options',
    defaultValue: false,
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
      },
    ],
  },
];

export default form;
