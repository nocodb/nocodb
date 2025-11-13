import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { NocoDBNode } from './nodes/nocodb';
import { RecordCreatedTriggerNode } from './nodes/record-created-trigger';
import { RecordUpdatedTriggerNode } from './nodes/record-updated-trigger';

export * from './manifest';
export * from './nodes/nocodb';
export * from './nodes/record-created-trigger';
export * from './nodes/record-updated-trigger';

// Export NocoDB node as an integration entry
export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb',
    wrapper: NocoDBNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_insert',
    wrapper: RecordCreatedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Created Trigger',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'nocodb.trigger.after_update',
    wrapper: RecordUpdatedTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'NocoDB - Record Updated Trigger',
    },
  },
];

export default entries;
