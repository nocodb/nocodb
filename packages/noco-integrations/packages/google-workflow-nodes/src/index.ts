import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { SendEmailNode } from './nodes/send-email';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'google.send_email',
    wrapper: SendEmailNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send email',
      icon: 'gmail',
      order: 14,
    },
  },
];

export default entries;
