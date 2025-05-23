import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { OpenAIIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'openai',
  wrapper: OpenAIIntegration,
  form,
  manifest,
};

export default integration;
