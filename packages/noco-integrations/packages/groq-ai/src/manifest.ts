import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Groq',
  icon: 'groq',
  description: 'Groq AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 4,
}); 