import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Linear',
  icon: 'linearSolid',
  version: '0.1.0',
  description: 'Sync Linear issues and projects',
  sync_category: SyncCategory.TICKETING,
};

export default manifest; 