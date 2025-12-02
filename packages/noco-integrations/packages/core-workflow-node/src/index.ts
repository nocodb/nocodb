import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { ManualTriggerNode } from './nodes/manual-trigger';
import { IfNode } from './nodes/if';
import { SendEmailAction } from './nodes/send-email';

export * from './manifest';
export * from './nodes/manual-trigger';
export * from './nodes/if';
export * from './nodes/send-email';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.trigger.manual',
    wrapper: ManualTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'When manually triggered',
      icon: 'ncPlay'
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
      icon: 'ncIfElse'
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.action.send-email',
    wrapper: SendEmailAction,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send Email',
      icon: 'ncEmail'
    },
  },
];

export default entries;
