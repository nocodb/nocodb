import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import MySQLSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'mysql',
  wrapper: MySQLSyncIntegration,
  form,
  manifest,
};

export { manifest, form, MySQLSyncIntegration };
export default integration;
