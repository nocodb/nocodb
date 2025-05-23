import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import PostgresSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'postgres',
  wrapper: PostgresSyncIntegration,
  form,
  manifest,
};

export { manifest, form, PostgresSyncIntegration };
export default integration;
