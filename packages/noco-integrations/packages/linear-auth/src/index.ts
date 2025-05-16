import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { LinearAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'linear',
  wrapper: LinearAuthIntegration,
  form,
  manifest,
};

export default integration; 