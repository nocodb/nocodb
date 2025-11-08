import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import BitbucketSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'bitbucket',
  wrapper: BitbucketSyncIntegration,
  form,
  manifest,
};

export { manifest, form, BitbucketSyncIntegration };
export default integration;
