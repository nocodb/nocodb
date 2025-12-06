import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { BambooHRAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'bamboohr',
  wrapper: BambooHRAuthIntegration,
  form,
  manifest,
};

export { BambooHRAuthIntegration };

export default integration;
