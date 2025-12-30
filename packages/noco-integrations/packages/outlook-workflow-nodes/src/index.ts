import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { SendEmailNode } from './nodes/send-email';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'outlook.send_email',
    wrapper: SendEmailNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send Email',
      icon: 'microsoftOutlook',
      order: 15,
    },
  },
];

export default entries;
