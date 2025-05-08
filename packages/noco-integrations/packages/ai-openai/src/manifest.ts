import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'OpenAI',
  icon: 'openai',
  description: 'OpenAI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
});
