import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { TemplateAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'ai-template', // This should be replaced with your specific AI provider identifier
  wrapper: TemplateAiIntegration,
  form,
  manifest,
};

export default integration; 