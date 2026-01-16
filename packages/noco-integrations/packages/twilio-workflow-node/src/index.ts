import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { CallPhoneNode } from './nodes/call-phone';
import { SendSmsNode } from './nodes/send-sms';
import { SendWhatsAppNode } from './nodes/send-whatsapp';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'twilio.action.call_phone',
    wrapper: CallPhoneNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Call Phone',
      icon: 'ncTwilio',
      order: 1,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'twilio.action.send_sms',
    wrapper: SendSmsNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send SMS',
      icon: 'ncTwilio',
      order: 2,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'twilio.action.send_whatsapp',
    wrapper: SendWhatsAppNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send WhatsApp Message',
      icon: 'ncTwilio',
      order: 3,
    },
    packageManifest: manifest,
  },
];

export default entries;
