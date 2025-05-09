import { IntegrationType } from '@noco-integrations/core';
import { ClickhouseTableIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';
import type { IntegrationEntry } from '@noco-integrations/core';

const entry: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'clickhouse-table',
  wrapper: ClickhouseTableIntegration,
  form,
  manifest,
};

export default entry;
