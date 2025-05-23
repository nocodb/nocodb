import { FormBuilderInputType, IntegrationType } from '@noco-integrations/core';
import type { FormDefinition } from '@noco-integrations/core';

const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'PostgreSQL Connection',
    width: 100,
    model: 'config.authIntegrationId',
    category: 'Authentication',
    integrationFilter: {
      type: IntegrationType.Auth,
      sub_type: 'postgres',
    },
    validators: [
      {
        type: 'required' as const,
        message: 'PostgreSQL connection is required',
      },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Schema',
    width: 100,
    model: 'config.schema',
    category: 'Sync Settings',
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
        model: 'config.schema',
        notEmpty: true,
      },
    ],
  },
];

export default form;
