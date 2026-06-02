import { IntegrationType } from '@noco-integrations/core';
import { MssqlAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';
import type { IntegrationEntry } from '@noco-integrations/core';

const entry: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'mssql',
  wrapper: MssqlAuthIntegration,
  form,
  manifest,
};

export { MssqlAuthIntegration };

export default entry;
