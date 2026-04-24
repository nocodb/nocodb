import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { SendTransactionalEmailNode } from './nodes/send-transactional-email';
import { CreateCampaignNode } from './nodes/create-campaign';
import { SendCampaignNode } from './nodes/send-campaign';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.send_transactional_email',
    wrapper: SendTransactionalEmailNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send transactional email',
      icon: 'ncMailchimp',
      order: 15,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.create_campaign',
    wrapper: CreateCampaignNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Create campaign',
      icon: 'ncMailchimp',
      order: 16,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.send_campaign',
    wrapper: SendCampaignNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Send campaign',
      icon: 'ncMailchimp',
      order: 17,
    },
    packageManifest: manifest,
  },
];

export default entries;
