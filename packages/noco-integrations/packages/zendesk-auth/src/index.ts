import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { ZendeskAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'zendesk',
  wrapper: ZendeskAuthIntegration,
  form,
  manifest,
};

export default integration;
