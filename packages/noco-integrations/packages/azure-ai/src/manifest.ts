import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Azure',
  icon: 'https://static.cdnlogo.com/logos/a/12/azure.svg',
  description: 'Azure AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 6,
});
