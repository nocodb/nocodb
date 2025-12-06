import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import manifest from './manifest';
import form from './form';
import BoxSyncIntegration from './integration';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'box',
  wrapper: BoxSyncIntegration,
  form,
  manifest,
};

export { manifest, form, BoxSyncIntegration };
export default integration;
