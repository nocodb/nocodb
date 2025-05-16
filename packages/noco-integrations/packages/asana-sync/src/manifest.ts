import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';

const manifest: IntegrationManifest = {
  title: 'Asana',
  icon: 'asanaSolid',
  version: '0.1.0',
  description: 'Sync Asana tasks and projects',
  sync_category: SyncCategory.TICKETING,
};

export default manifest;
