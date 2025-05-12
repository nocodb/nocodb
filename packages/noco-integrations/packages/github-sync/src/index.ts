import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import GithubSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'github-issues',
  wrapper: GithubSyncIntegration,
  form,
  manifest,
};

export { manifest, form, GithubSyncIntegration };
export default integration;
