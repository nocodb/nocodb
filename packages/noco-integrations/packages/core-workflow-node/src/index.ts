import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { ManualTriggerNode } from './nodes/manual-trigger';
import { CronTriggerNode } from './nodes/cron-trigger';
import { IfNode } from './nodes/if';
import { SendEmailAction } from './nodes/send-email';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.trigger.manual',
    wrapper: ManualTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'When manually triggered',
      icon: 'ncPlay',
      order: 4,
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.trigger.cron',
    wrapper: CronTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Schedule / Cron',
      icon: 'ncClock',
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
      icon: 'ncIfElse',
      order: 5,
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
      icon: 'ncMail',
      order: 12,
    },
  },
];

export default entries;
