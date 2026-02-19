import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: 'HubSpot CRM',
  icon: 'hubspot',
  description:
    'Manage HubSpot CRM objects including contacts, companies, deals, custom objects, associations, and more',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://github.com/nocodb/nocodb',
  order: 10,
};
