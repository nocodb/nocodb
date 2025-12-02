import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { SlackAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'slack',
  wrapper: SlackAuthIntegration,
  form,
  manifest,
};

export { SlackAuthIntegration };

export default integration;
