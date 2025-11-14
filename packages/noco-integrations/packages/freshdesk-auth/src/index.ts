/**
 * Freshdesk Auth Integration
 *
 * Provides API key authentication for Freshdesk API.
 *
 * @packageDocumentation
 */

import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { FreshdeskAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'freshdesk',
  wrapper: FreshdeskAuthIntegration,
  form,
  manifest,
};

export { FreshdeskAuthIntegration };

export default integration;
