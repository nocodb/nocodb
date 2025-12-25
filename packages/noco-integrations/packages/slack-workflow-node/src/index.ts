import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { SendMessageNode } from './nodes/send-message';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'slack.send_message',
    wrapper: SendMessageNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send Message',
      icon: 'ncSlack',
      order: 13,
    },
    packageManifest: manifest,
  },
];

export default entries;
