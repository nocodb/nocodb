import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';

// Email
import { SendTransactionalEmailNode } from './nodes/send-transactional-email';

// Campaign
import { CreateCampaignNode } from './nodes/create-campaign';
import { GetCampaignNode } from './nodes/get-campaign';
import { UpdateCampaignNode } from './nodes/update-campaign';
import { DeleteCampaignNode } from './nodes/delete-campaign';
import { SendCampaignNode } from './nodes/send-campaign';
import { ListCampaignsNode } from './nodes/list-campaigns';

// Contact
import { AddContactNode } from './nodes/add-contact';
import { GetContactNode } from './nodes/get-contact';
import { UpdateContactNode } from './nodes/update-contact';
import { DeleteContactNode } from './nodes/delete-contact';

// Contact — tags
import { TagContactNode } from './nodes/tag-contact';
import { UntagContactNode } from './nodes/untag-contact';

// Contact — subscription
import { SubscribeContactNode } from './nodes/subscribe-contact';
import { UnsubscribeContactNode } from './nodes/unsubscribe-contact';

// Audience
import { CreateListNode } from './nodes/create-list';
import { GetListNode } from './nodes/get-list';
import { UpdateListNode } from './nodes/update-list';
import { DeleteListNode } from './nodes/delete-list';
import { ListAudiencesNode } from './nodes/list-audiences';
import { ListAudienceMembersNode } from './nodes/list-audience-members';

export const entries: IntegrationEntry[] = [
  // ── Email ──────────────────────────────────────────
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.send_transactional_email',
    wrapper: SendTransactionalEmailNode,
    form: [],
    manifest: { ...manifest, title: 'Send transactional email', icon: 'ncMailchimp', order: 1 },
    packageManifest: manifest,
  },

  // ── Campaign ───────────────────────────────────────
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.create_campaign',
    wrapper: CreateCampaignNode,
    form: [],
    manifest: { ...manifest, title: 'Create campaign', icon: 'ncMailchimp', order: 2 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.get_campaign',
    wrapper: GetCampaignNode,
    form: [],
    manifest: { ...manifest, title: 'Get campaign', icon: 'ncMailchimp', order: 3 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.update_campaign',
    wrapper: UpdateCampaignNode,
    form: [],
    manifest: { ...manifest, title: 'Update campaign', icon: 'ncMailchimp', order: 4 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.delete_campaign',
    wrapper: DeleteCampaignNode,
    form: [],
    manifest: { ...manifest, title: 'Delete campaign', icon: 'ncMailchimp', order: 5 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.send_campaign',
    wrapper: SendCampaignNode,
    form: [],
    manifest: { ...manifest, title: 'Send campaign', icon: 'ncMailchimp', order: 6 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.list_campaigns',
    wrapper: ListCampaignsNode,
    form: [],
    manifest: { ...manifest, title: 'List campaigns', icon: 'ncMailchimp', order: 7 },
    packageManifest: manifest,
  },

  // ── Contact ────────────────────────────────────────
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.add_contact',
    wrapper: AddContactNode,
    form: [],
    manifest: { ...manifest, title: 'Add contact', icon: 'ncMailchimp', order: 8 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.get_contact',
    wrapper: GetContactNode,
    form: [],
    manifest: { ...manifest, title: 'Get contact', icon: 'ncMailchimp', order: 9 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.update_contact',
    wrapper: UpdateContactNode,
    form: [],
    manifest: { ...manifest, title: 'Update contact', icon: 'ncMailchimp', order: 10 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.delete_contact',
    wrapper: DeleteContactNode,
    form: [],
    manifest: { ...manifest, title: 'Delete contact', icon: 'ncMailchimp', order: 11 },
    packageManifest: manifest,
  },

  // ── Contact — Tags ─────────────────────────────────
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.tag_contact',
    wrapper: TagContactNode,
    form: [],
    manifest: { ...manifest, title: 'Tag contact', icon: 'ncMailchimp', order: 12 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.untag_contact',
    wrapper: UntagContactNode,
    form: [],
    manifest: { ...manifest, title: 'Untag contact', icon: 'ncMailchimp', order: 13 },
    packageManifest: manifest,
  },

  // ── Contact — Subscription ─────────────────────────
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.subscribe_contact',
    wrapper: SubscribeContactNode,
    form: [],
    manifest: { ...manifest, title: 'Subscribe contact', icon: 'ncMailchimp', order: 14 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.unsubscribe_contact',
    wrapper: UnsubscribeContactNode,
    form: [],
    manifest: { ...manifest, title: 'Unsubscribe contact', icon: 'ncMailchimp', order: 15 },
    packageManifest: manifest,
  },

  // ── Audience ───────────────────────────────────────
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.create_list',
    wrapper: CreateListNode,
    form: [],
    manifest: { ...manifest, title: 'Create audience', icon: 'ncMailchimp', order: 16 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.get_list',
    wrapper: GetListNode,
    form: [],
    manifest: { ...manifest, title: 'Get audience', icon: 'ncMailchimp', order: 17 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.update_list',
    wrapper: UpdateListNode,
    form: [],
    manifest: { ...manifest, title: 'Update audience', icon: 'ncMailchimp', order: 18 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.delete_list',
    wrapper: DeleteListNode,
    form: [],
    manifest: { ...manifest, title: 'Delete audience', icon: 'ncMailchimp', order: 19 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.list_audiences',
    wrapper: ListAudiencesNode,
    form: [],
    manifest: { ...manifest, title: 'List audiences', icon: 'ncMailchimp', order: 20 },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'mailchimp.list_audience_members',
    wrapper: ListAudienceMembersNode,
    form: [],
    manifest: { ...manifest, title: 'Get audience members', icon: 'ncMailchimp', order: 21 },
    packageManifest: manifest,
  },
];

export default entries;
