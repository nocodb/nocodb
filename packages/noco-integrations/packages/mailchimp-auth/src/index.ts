import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { MailchimpAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'mailchimp',
  wrapper: MailchimpAuthIntegration,
  form,
  manifest,
};

export { MailchimpAuthIntegration };
export type { MailchimpAuthConfig } from './types';

export default integration;
