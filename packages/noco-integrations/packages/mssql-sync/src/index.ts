import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import MssqlSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'mssql',
  wrapper: MssqlSyncIntegration,
  form,
  manifest,
};

export { manifest, form, MssqlSyncIntegration };
export default integration;
