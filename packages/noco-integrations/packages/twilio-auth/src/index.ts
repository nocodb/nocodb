import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { TwilioAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'twilio',
  wrapper: TwilioAuthIntegration,
  form,
  manifest,
};

export { TwilioAuthIntegration };

export default integration;
