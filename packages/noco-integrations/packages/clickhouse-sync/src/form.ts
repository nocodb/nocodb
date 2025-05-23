import { FormBuilderInputType, IntegrationType } from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'ClickHouse Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'clickhouse',
    },
    validators: [
      {
        type: 'required' as const,
        message: 'ClickHouse connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Database',
    width: 100,
    model: 'config.database',
    category: 'Sync Settings',
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
    category: 'Sync Settings',
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