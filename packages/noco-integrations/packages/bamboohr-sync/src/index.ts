import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import manifest from './manifest';
import form from './form';
import BambooHRSyncIntegration from './integration';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'bamboohr',
  wrapper: BambooHRSyncIntegration,
  form,
  manifest,
};

export { manifest, form, BambooHRSyncIntegration };
export default integration;
