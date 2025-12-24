import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { ManualTriggerNode } from './nodes/manual-trigger';
import { CronTriggerNode } from './nodes/cron-trigger';
import { IfNode } from './nodes/if';
import { IterateNode } from './nodes/iterate';
import { SendEmailAction } from './nodes/send-email';
import { DelayNode } from './nodes/delay';
import { WaitUntilNode } from './nodes/wait-until';
import { GenerateTextAction } from './nodes/generate-text';
import { GenerateStructuredAction } from './nodes/generate-structured';

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
      title: 'At scheduled time',
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
    sub_type: 'core.flow.iterate',
    wrapper: IterateNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Iterate',
      icon: 'ncRepeat',
      order: 6,
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
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.flow.delay',
    wrapper: DelayNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Delay',
      icon: 'ncClock',
      order: 7,
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.flow.wait-until',
    wrapper: WaitUntilNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Wait Until',
      icon: 'ncCalendar',
      order: 8,
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.action.generate-text',
    wrapper: GenerateTextAction,
    form: [],
    manifest: {
      ...manifest,
      title: 'Generate Text with AI',
      icon: 'openai',
      order: 13,
    },
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'core.action.generate-structured',
    wrapper: GenerateStructuredAction,
    form: [],
    manifest: {
      ...manifest,
      title: 'Generate Structured Data with AI',
      icon: 'openai',
      order: 14,
    },
  },
];

export default entries;
