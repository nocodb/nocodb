import { IntegrationType } from '@noco-integrations/core';
import { NocodbAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';
import type { IntegrationEntry } from '@noco-integrations/core';

const entry: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'nocodb',
  wrapper: NocodbAiIntegration,
  form,
  manifest,
};

export default entry;
