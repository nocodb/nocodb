import { type IntegrationEntry, IntegrationType } from '@noco-integrations/core';
import { manifest } from './manifest';
import { NocoDBNode } from './nodes/nocodb';

export * from './manifest';
export * from './nodes/nocodb';

// Export NocoDB node as an integration entry
export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.action.database',
    wrapper: NocoDBNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB',
    },
  },
];

export default entries;
