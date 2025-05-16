import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: 'GitLab',
  icon: 'gitlab',
  description: 'GitLab authentication integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://gitlab.com',
  order: 2,
};
