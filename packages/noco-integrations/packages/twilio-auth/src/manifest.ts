import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: 'Twilio',
  icon: 'twilio',
  description: 'Twilio authentication integration for NocoDB workflows',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://github.com/nocodb/nocodb',
  order: 10,
  iconStyle: {
    width: '32px',
    height: '32px',
  },
};
