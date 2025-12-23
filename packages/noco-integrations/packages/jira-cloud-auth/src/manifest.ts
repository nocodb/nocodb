import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: 'Jira Cloud',
  icon: 'jira',
  description: 'Jira cloud authentication integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://www.atlassian.com/software/jira',
  order: 3,
};
