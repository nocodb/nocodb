import { APP_LABEL } from './constant';
import type { IntegrationManifest } from '@noco-integrations/core';

export const manifest: IntegrationManifest = {
  title: APP_LABEL,
  icon: 'ncMail',
  description:
    'Send emails via any SMTP server — SendGrid, Mailgun, SES, or your own server',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://nocodb.com',
  order: 10,
  iconStyle: {
    width: '32px',
    height: '32px',
  },
};
