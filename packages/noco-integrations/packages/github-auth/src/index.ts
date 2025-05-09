import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GithubAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'github',
  wrapper: GithubAuthIntegration,
  form,
  manifest,
};

export default integration;
