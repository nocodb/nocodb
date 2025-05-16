import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { AsanaAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'asana',
  wrapper: AsanaAuthIntegration,
  form,
  manifest,
};

export default integration; 