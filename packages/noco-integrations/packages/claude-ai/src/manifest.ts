import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Claude',
  icon: 'claude',
  description: 'Anthropic Claude AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 2,
}); 