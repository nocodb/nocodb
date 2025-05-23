import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

/**
 * Manifest for the sync integration
 * Defines metadata about the integration
 */
const manifest: IntegrationManifest = {
  title: 'Provider Name',
  icon: 'providerIcon', // Use an icon from the icon library or provide a URL
  version: '0.1.0',
  description: 'Sync data from Provider service',
  sync_category: SyncCategory.TICKETING, // Or other appropriate category
};

export default manifest; 