import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { BoxAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'box',
  wrapper: BoxAuthIntegration,
  form,
  manifest,
};

export { BoxAuthIntegration };

export default integration;
