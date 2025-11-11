import { SyncCategory } from '@noco-integrations/core';
import type { IntegrationManifest } from '@noco-integrations/core';

/**
 * Freshdesk Sync Integration Manifest
 *
 * Provides metadata and configuration for the Freshdesk sync integration.
 */
export const manifest: IntegrationManifest = {
  title: 'Freshdesk',
  icon: 'freshdesk',
  sync_category: SyncCategory.TICKETING,
  description: 'Sync tickets, contacts, agents, and groups from Freshdesk',
  version: '1.0.0',
  author: 'NocoDB',
  website: 'https://www.freshdesk.com',
  order: 11,
};
