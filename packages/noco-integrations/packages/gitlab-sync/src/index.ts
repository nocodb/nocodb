import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import GitlabSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'gitlab',
  wrapper: GitlabSyncIntegration,
  form,
  manifest,
};

export { manifest, form, GitlabSyncIntegration };
export default integration;
