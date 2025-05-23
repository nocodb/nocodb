import { IntegrationType } from '@noco-integrations/core';
import { PostgresAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';
import type { IntegrationEntry } from '@noco-integrations/core';

const entry: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'postgres',
  wrapper: PostgresAuthIntegration,
  form,
  manifest,
};

export default entry;
