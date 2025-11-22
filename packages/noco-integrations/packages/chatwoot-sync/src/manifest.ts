import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Chatwoot',
  icon: 'chatwoot',
  version: '0.1.0',
  description: 'Sync Chatwoot conversations and messages',
  sync_category: SyncCategory.TICKETING,
  order: 7, // order in the sync integration list
};

export default manifest;
