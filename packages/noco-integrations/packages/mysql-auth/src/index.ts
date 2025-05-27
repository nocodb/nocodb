import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { MySQLAuthIntegration } from './integration';
import manifest from './manifest';
import form from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'mysql',
  wrapper: MySQLAuthIntegration,
  form,
  manifest,
};

export { manifest, form, MySQLAuthIntegration };
export default integration;
