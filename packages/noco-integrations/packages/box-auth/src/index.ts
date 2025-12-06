import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GoogleDriveAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'google-drive',
  wrapper: GoogleDriveAuthIntegration,
  form,
  manifest,
};

export { GoogleDriveAuthIntegration };

export default integration;
