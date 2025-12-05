import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { DropboxAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'dropbox',
  wrapper: DropboxAuthIntegration,
  form,
  manifest,
};

export { DropboxAuthIntegration };

export default integration;
