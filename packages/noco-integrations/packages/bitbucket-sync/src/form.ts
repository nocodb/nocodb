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
    label: 'Bitbucket Connection',
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
    label: 'Repositories',
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
    type: FormBuilderInputType.Switch,
    label: 'Include closed issues',
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
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'Options',
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
