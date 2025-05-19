import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Azure OpenAI',
  icon: 'azure',
  description: 'Azure OpenAI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 6,
}); 