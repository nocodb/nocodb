import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import JiraSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'jira',
  wrapper: JiraSyncIntegration,
  form,
  manifest,
};

export { manifest, form, JiraSyncIntegration };
export default integration;
