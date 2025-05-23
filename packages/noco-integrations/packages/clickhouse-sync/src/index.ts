import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import ClickHouseSyncIntegration from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'clickhouse',
  wrapper: ClickHouseSyncIntegration,
  form,
  manifest,
};

export { manifest, form, ClickHouseSyncIntegration };
export default integration; 