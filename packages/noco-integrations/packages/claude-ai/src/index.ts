import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { ClaudeIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'claude',
  wrapper: ClaudeIntegration,
  form,
  manifest,
};

export default integration;
