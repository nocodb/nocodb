import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { ProviderAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'provider', // TODO: Replace with your provider identifier (e.g., 'github', 'gitlab', 'asana')
  wrapper: ProviderAuthIntegration,
  form,
  manifest,
};

export default integration; 