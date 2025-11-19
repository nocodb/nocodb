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
    label: 'PostgreSQL connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'postgres',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'PostgreSQL connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Schema',
    width: 100,
    model: 'config.schema',
    category: 'General',
    placeholder: 'Select schema to sync',
    options: [],
    fetchOptionsKey: 'schemas',
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Tables',
    width: 100,
    model: 'config.tables',
    category: 'General',
    placeholder: 'Select tables to sync',
    selectMode: 'multiple',
    options: [],
    fetchOptionsKey: 'tables',
    condition: [
      {
        model: 'config.authIntegrationId',
        notEmpty: true,
      },
      {
        model: 'config.schema',
        notEmpty: true,
      },
    ],
  },
];

export default form;
