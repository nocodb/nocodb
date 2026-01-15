import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { GoogleCalendarTriggerNode } from './nodes/google-calendar-trigger';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'google_calendar.trigger',
    wrapper: GoogleCalendarTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Google Calendar Trigger',
      icon: 'googleCalendar',
      order: 14,
    },
    packageManifest: manifest,
  },
];

export default entries;
