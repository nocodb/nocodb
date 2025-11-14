import {
  IntegrationType,
  type IntegrationEntry,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { ManualTriggerNode } from './nodes/manual-trigger';
import { IfNode } from './nodes/if';

export * from './manifest';
export * from './nodes/manual-trigger';
export * from './nodes/if';

// Export each node as a separate integration entry
export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.trigger.manual',
    wrapper: ManualTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Manual Trigger',
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.flow.if',
    wrapper: IfNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'If Condition',
    },
  },
];

export default entries;
