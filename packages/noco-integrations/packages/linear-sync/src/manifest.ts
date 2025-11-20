import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Linear',
  icon: 'linear',
  version: '0.1.0',
  description: 'Sync Linear issues and projects',
  sync_category: SyncCategory.TICKETING,
  order: 4, // order in the sync integration list
};

export default manifest;
