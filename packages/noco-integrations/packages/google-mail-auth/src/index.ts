import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GmailAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'gmail',
  wrapper: GmailAuthIntegration,
  form,
  manifest,
};

export { GmailAuthIntegration };

export default integration;
