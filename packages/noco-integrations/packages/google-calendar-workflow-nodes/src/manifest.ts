import type { IntegrationManifest } from '@noco-integrations/core';
import { APP_LABEL } from './constant';

export const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'googleCalendar',
  description: APP_LABEL + ' workflow nodes for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://www.google.com',
  order: 3,
};
