import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Auth, {
  title: 'Auth Integration',
  icon: 'auth', // Replace with appropriate icon
  description: 'Authentication integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://nocodb.com',
  order: 1,
}); 