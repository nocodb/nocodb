import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Jira',
  icon: 'jira',
  version: '0.1.0',
  description: 'Sync Jira issues and projects',
  sync_category: SyncCategory.TICKETING,
};

export default manifest;
