import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GeminiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'gemini',
  wrapper: GeminiIntegration,
  form,
  manifest,
};

export default integration;
