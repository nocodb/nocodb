import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import ChatwootSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'chatwoot',
  wrapper: ChatwootSyncIntegration,
  form,
  manifest,
};

export { manifest, form, ChatwootSyncIntegration };
export default integration;