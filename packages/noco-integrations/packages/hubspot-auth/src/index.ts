import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { HubspotAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'hubspot',
  wrapper: HubspotAuthIntegration,
  form,
  manifest,
};

export { HubspotAuthIntegration };

export default integration;
