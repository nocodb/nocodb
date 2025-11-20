import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Bitbucket',
  icon: 'bitBucket',
  version: '0.1.0',
  description: 'Sync Bitbucket issues and pull requests from your repositories',
  sync_category: SyncCategory.TICKETING,
  order: 6, // order in the sync integration list
};

export default manifest;
