import { IntegrationEntry, IntegrationType } from '@noco-integrations/core';
import { ClickhouseAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const entry: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'clickhouse',
  wrapper: ClickhouseAuthIntegration,
  form,
  manifest,
};

export default entry;
