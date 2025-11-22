import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'GitHub',
  icon: 'githubSolid',
  version: '0.1.0',
  description: 'Sync GitHub and pull requests from your repositories',
  sync_category: SyncCategory.TICKETING,
  order: 1, // order in the sync integration list
};

export default manifest;
