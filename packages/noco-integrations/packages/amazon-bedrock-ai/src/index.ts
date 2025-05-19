import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { AmazonBedrockAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'amazon-bedrock',
  wrapper: AmazonBedrockAiIntegration,
  form,
  manifest,
};

export default integration; 