import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: 'GitHub',
  icon: 'github',
  description: 'Trigger workflows on GitHub events',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://github.com/nocodb/nocodb',
  order: 3,
};
