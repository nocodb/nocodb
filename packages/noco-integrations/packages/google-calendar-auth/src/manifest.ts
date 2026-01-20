import { APP_LABEL } from './constant';
import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'googleCalendar',
  description: APP_LABEL + ' authentication integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://mail.google.com',
  order: 6,
};
