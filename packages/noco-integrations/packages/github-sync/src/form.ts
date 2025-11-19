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
    label: 'GitHub connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
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
    type: FormBuilderInputType.Select,
    label: 'Select one or more repositories',
    width: 100,
    model: 'config.repos',
    category: 'General',
    placeholder: 'e.g., nocodb/nocodb',
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
    description: 'Sync both open and closed issues to maintain a complete record of project history and resolutions.',
    width: 48,
    model: 'config.includeClosed',
    category: 'Options',
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
    label: 'Pull requests',
    description: 'Sync pull requests along with issues to track code changes, reviews, and merges within your workspace.',
    width: 48,
    model: 'config.includePRs',
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
