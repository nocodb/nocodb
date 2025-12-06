import {
  type IntegrationManifest,
  SyncCategory,
} from '@noco-integrations/core';
import { APP_LABEL } from './constant';

const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'ncLogoGoogleDriveColored',
  version: '0.1.0',
  description: 'Sync ' + APP_LABEL + ' files',
  sync_category: SyncCategory.FILE_STORAGE,
  order: 4, // order in the sync integration list
};

export default manifest;
