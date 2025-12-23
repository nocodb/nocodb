import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import JiraCloudSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'jira-cloud',
  wrapper: JiraCloudSyncIntegration,
  form,
  manifest,
};

export { manifest, form, JiraCloudSyncIntegration };
export default integration;
