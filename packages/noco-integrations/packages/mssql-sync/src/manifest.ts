import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Microsoft SQL Server',
  icon: 'mssqlServer',
  version: '0.1.0',
  description: 'Sync data with Microsoft SQL Server database',
  author: 'NocoDB',
  sync_category: SyncCategory.CUSTOM,
  order: 10, // order in the sync integration list
};

export default manifest;
