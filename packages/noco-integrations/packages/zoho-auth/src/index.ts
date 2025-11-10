import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { ZohoAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'zoho',
  wrapper: ZohoAuthIntegration,
  form,
  manifest,
};

export default integration;
