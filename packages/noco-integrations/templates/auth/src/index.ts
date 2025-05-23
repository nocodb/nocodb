import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { TemplateAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'auth-template', // This should be replaced with your specific service identifier
  wrapper: TemplateAuthIntegration,
  form,
  manifest,
};

export default integration; 