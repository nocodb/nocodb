/**
 * Freshdesk Sync Integration
 *
 * Syncs tickets, contacts, agents, and groups from Freshdesk to NocoDB.
 *
 * @packageDocumentation
 */

import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import FreshdeskSyncIntegration from './integration';
import { manifest } from './manifest';
import { form } from './form';

const integration: IntegrationEntry = {
  type: IntegrationType.Sync,
  sub_type: 'freshdesk',
  wrapper: FreshdeskSyncIntegration,
  form,
  manifest,
};

export { manifest, form, FreshdeskSyncIntegration };
export default integration;
