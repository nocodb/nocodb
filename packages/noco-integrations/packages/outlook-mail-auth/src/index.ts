import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { OutlookAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'outlook',
  wrapper: OutlookAuthIntegration,
  form,
  manifest,
};

export { OutlookAuthIntegration };

export default integration;
