import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'PostgreSQL',
  icon: 'postgreSql',
  version: '0.1.0',
  description: 'Sync data with PostgreSQL database',
  author: 'NocoDB',
  sync_category: SyncCategory.CUSTOM,
};

export default manifest;
