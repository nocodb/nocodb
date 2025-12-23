import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { JiraCloudAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'jira-cloud',
  wrapper: JiraCloudAuthIntegration,
  form,
  manifest,
};
export { JiraCloudAuthIntegration };

export default integration;
