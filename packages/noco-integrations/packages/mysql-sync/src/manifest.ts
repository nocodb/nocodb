import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'MySQL',
  icon: 'mysql',
  version: '0.1.0',
  description: 'Sync data with MySQL database',
  author: 'NocoDB',
  sync_category: SyncCategory.CUSTOM,
};

export default manifest;
