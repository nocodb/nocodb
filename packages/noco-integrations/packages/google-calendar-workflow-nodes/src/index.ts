import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { NewEventWebhookNode } from './nodes/new-event-webhook';
import { NODE_SUBTYPE_NEW_EVENT } from './constant';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: NODE_SUBTYPE_NEW_EVENT,
    wrapper: NewEventWebhookNode,
    form: [],
    manifest: {
      ...manifest,
      title: `New Event Webhook`,
      icon: 'googleCalendar',
      order: 14,
    },
    packageManifest: manifest,
  },
];

export default entries;
