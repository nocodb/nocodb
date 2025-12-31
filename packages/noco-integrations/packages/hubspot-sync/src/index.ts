import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import manifest from './manifest';
import form from './form';
import HubspotSyncIntegration from './integration';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'hubspot',
  wrapper: HubspotSyncIntegration,
  form,
  manifest,
};

export { manifest, form, HubspotSyncIntegration };
export default integration;
