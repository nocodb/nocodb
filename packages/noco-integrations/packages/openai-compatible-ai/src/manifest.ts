import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'OpenAI Compatible',
  icon: 'openai',
  description: 'OpenAI API compatible integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 8,
}); 