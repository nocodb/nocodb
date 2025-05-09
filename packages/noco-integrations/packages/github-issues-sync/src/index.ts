import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import GithubIssuesIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'github-issues',
  wrapper: GithubIssuesIntegration,
  form,
  manifest,
};

export { manifest, form, GithubIssuesIntegration };
export default integration;
