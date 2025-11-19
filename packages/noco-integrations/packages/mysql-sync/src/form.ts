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
    label: 'MySQL Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'General',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'mysql',
    },
    validators: [
      {
        type: FormBuilderValidatorType.Required,
        message: 'MySQL connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Database',
    width: 100,
    model: 'config.database',
    category: 'General',
    placeholder: 'Select database to sync',
    options: [],
    fetchOptionsKey: 'databases',
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
        model: 'config.database',
        notEmpty: true,
      },
    ],
  },
];

export default form;
