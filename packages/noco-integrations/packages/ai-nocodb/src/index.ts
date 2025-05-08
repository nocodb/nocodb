import { IntegrationEntry, IntegrationType } from '@noco-integrations/core';
import { NocodbAiIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const entry: IntegrationEntry = {
  type: IntegrationType.Ai,
  sub_type: 'nocodb',
  wrapper: NocodbAiIntegration,
  form,
  manifest,
};

export default entry;
