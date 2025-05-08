import {
  FormBuilderInputType,
  FormDefinition,
  IntegrationType,
} from '@noco-integrations/core';

export const form: FormDefinition = [
  {
    type: FormBuilderInputType.Input,
    label: 'Sync name',
    width: 100,
    model: 'title',
    placeholder: 'Sync name',
    category: 'General',
    validators: [
      {
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Auth Provider',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'clickhouse',
    },
    validators: [
      {
        type: 'required',
        message: 'Auth Provider is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Table Name',
    width: 100,
    model: 'config.table',
    placeholder: 'Table name',
    category: 'Source',
    validators: [
      {
        type: 'required',
        message: 'Table name is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    selectMode: 'multipleWithInput',
    label: 'Primary Key Column',
    width: 100,
    model: 'config.system.primaryKey',
    placeholder: 'Primary key column',
    category: 'System Fields',
    validators: [
      {
        type: 'required',
        message: 'Primary key column is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Created At Column',
    width: 48,
    model: 'config.system.createdAt',
    category: 'System Fields',
  },
  {
    type: FormBuilderInputType.Space,
    width: 4,
    category: 'System Fields',
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Updated At Column',
    width: 48,
    model: 'config.system.updatedAt',
    category: 'System Fields',
  },
];
