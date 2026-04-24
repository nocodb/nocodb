import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { MailchimpAuthIntegration } from './integration';
import { oauthForm, apiKeyForm } from './form';
import { manifest } from './manifest';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.Auth,
    sub_type: 'mailchimp.oauth',
    wrapper: MailchimpAuthIntegration,
    form: oauthForm,
    manifest: {
      ...manifest,
      title: 'Mailchimp (OAuth)',
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.Auth,
    sub_type: 'mailchimp.api-key',
    wrapper: MailchimpAuthIntegration,
    form: apiKeyForm,
    manifest: {
      ...manifest,
      title: 'Mailchimp (API Key)',
    },
    packageManifest: manifest,
  },
];

export { MailchimpAuthIntegration };
export type { MailchimpAuthConfig } from './types';

export default entries;
