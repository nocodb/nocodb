import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { JiraAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'jira',
  wrapper: JiraAuthIntegration,
  form,
  manifest,
};

export default integration;
