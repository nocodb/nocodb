import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import LinearSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'linear',
  wrapper: LinearSyncIntegration,
  form,
  manifest,
};

export { manifest, form, LinearSyncIntegration };
export default integration;
