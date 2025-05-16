import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GitlabAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'gitlab',
  wrapper: GitlabAuthIntegration,
  form,
  manifest,
};

export default integration;
