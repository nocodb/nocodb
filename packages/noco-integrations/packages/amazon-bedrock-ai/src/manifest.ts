import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Amazon Bedrock',
  icon: 'aws',
  description: 'Amazon Bedrock AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 5,
}); 