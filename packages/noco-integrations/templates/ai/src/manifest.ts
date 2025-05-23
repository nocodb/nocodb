import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'AI Integration',
  icon: 'ai', // Replace with appropriate icon
  description: 'AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 1,
}); 