import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'bamboohr',
  description: APP_LABEL + ' authentication integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://www.bamboohr.com',
  order: 5,
};
