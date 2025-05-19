import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Amazon Bedrock',
  icon: 'https://static.cdnlogo.com/logos/a/33/amazon-web-services.svg',
  description: 'Amazon Bedrock AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 5,
}); 