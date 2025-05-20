import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { AzureAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'azure-openai',
  wrapper: AzureAiIntegration,
  form,
  manifest,
};

export default integration;
