import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { OpenAiCompatibleAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'openai-compatible',
  wrapper: OpenAiCompatibleAiIntegration,
  form,
  manifest,
};

export default integration;
