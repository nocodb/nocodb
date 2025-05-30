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
    type: FormBuilderInputType.Select,
    label: 'Repositories',
    width: 100,
    model: 'config.repos',
    category: 'Source',
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
    type: FormBuilderInputType.Switch,
    label: 'Include closed issues',
    width: 48,
    model: 'config.includeClosed',
    category: 'Source',
    defaultValue: true,
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
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
      },
    ],
  },
  {
    type: FormBuilderInputType.Switch,
    label: 'Include Pull Requests',
    width: 48,
    model: 'config.includePRs',
    category: 'Source',
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
