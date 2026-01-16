import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: 'Twilio',
  icon: 'twilio',
  description: 'Make calls and send SMS/WhatsApp messages with Twilio',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://github.com/nocodb/nocodb',
  order: 10,
  hidden: true,
};
