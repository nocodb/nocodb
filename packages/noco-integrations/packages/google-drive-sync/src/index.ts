import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import manifest from './manifest';
import form from './form';
import GoogleDriveSyncIntegration from './integration';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'google-drive',
  wrapper: GoogleDriveSyncIntegration,
  form,
  manifest,
};

export { manifest, form, GoogleDriveSyncIntegration };
export default integration;
