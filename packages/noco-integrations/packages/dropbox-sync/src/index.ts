import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import manifest from './manifest';
import form from './form';
import DropboxSyncIntegration from './integration';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'dropbox',
  wrapper: DropboxSyncIntegration,
  form,
  manifest,
};

export { manifest, form, DropboxSyncIntegration };
export default integration;
