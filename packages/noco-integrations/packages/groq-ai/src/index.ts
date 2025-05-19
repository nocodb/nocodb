import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GroqAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'groq',
  wrapper: GroqAiIntegration,
  form,
  manifest,
};

export default integration; 