import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { SmtpAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'smtp',
  wrapper: SmtpAuthIntegration,
  form,
  manifest,
};

export { SmtpAuthIntegration };
export type { SmtpAuthConfig } from './types';

export default integration;
