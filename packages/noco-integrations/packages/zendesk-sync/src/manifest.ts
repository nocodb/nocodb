import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Zendesk',
  icon: 'zendeskSolid',
  version: '0.1.0',
  description: 'Sync Zendesk tickets and users',
  sync_category: SyncCategory.TICKETING,
};

export default manifest;
