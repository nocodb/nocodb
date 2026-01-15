import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { GoogleCalendarAuthIntegration } from './integration';
import { form } from './form';
import { manifest } from './manifest';

const integration: IntegrationEntry = {
  type: IntegrationType.Auth,
  sub_type: 'google_calendar',
  wrapper: GoogleCalendarAuthIntegration,
  form,
  manifest,
};

export { GoogleCalendarAuthIntegration };

export default integration;
