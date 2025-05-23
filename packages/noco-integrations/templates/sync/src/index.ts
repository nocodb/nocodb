import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import ProviderSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'provider', // Replace with actual provider name
  wrapper: ProviderSyncIntegration,
  form,
  manifest,
};

export { manifest, form, ProviderSyncIntegration };
export default integration; 