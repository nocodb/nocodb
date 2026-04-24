import { APP_LABEL } from './constant';
import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'ncMailchimp',
  description: APP_LABEL + ' email marketing integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://mailchimp.com',
  order: 15,
};
