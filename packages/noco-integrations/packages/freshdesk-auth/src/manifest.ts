import type { IntegrationManifest } from '@noco-integrations/core';

/**
 * Freshdesk Auth Integration Manifest
 * 
 * Provides metadata and configuration for the Freshdesk authentication integration.
 */
export const manifest: IntegrationManifest = {
  title: 'Freshdesk',
  icon: 'freshdesk',
  description: 'Authenticate with Freshdesk using API Key',
  version: '1.0.0',
  author: 'NocoDB',
  website: 'https://www.freshdesk.com',
  order: 11,
};
