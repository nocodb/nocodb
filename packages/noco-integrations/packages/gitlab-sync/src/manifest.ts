import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'GitLab',
  icon: 'gitlab',
  version: '0.1.0',
  description: 'Sync GitLab issues and comments from your repositories',
  sync_category: SyncCategory.TICKETING,
  order: 2, // order in the sync integration list
};

export default manifest;
