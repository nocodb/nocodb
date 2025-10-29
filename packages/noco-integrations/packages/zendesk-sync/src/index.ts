import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import ZendeskSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'zendesk',
  wrapper: ZendeskSyncIntegration,
  form,
  manifest,
};

export { manifest, form, ZendeskSyncIntegration };
export default integration;
