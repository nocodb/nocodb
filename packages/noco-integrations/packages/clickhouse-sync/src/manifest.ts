import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'ClickHouse',
  icon: 'ncDatabase',
  version: '0.1.0',
  description: 'Sync data with ClickHouse database',
  author: 'NocoDB',
  sync_category: SyncCategory.CUSTOM,
};

export default manifest; 