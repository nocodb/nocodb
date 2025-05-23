import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import AsanaSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'asana',
  wrapper: AsanaSyncIntegration,
  form,
  manifest,
};

export { manifest, form, AsanaSyncIntegration };
export default integration;
