import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';
import { APP_LABEL } from './constant';

const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'dropbox',
  version: '0.1.0',
  description: 'Sync ' + APP_LABEL + ' dropbox file',
  sync_category: SyncCategory.HRIS,
  order: 6, // order in the sync integration list
};

export default manifest;
