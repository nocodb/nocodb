import { createManifest, IntegrationType } from '@noco-integrations/core';

export const manifest = createManifest(IntegrationType.Ai, {
  title: 'Google',
  icon: 'https://www.cdnlogo.com/logos/g/35/google-icon.svg',
  description: 'Google Gemini AI integration for NocoDB',
  version: '0.1.0',
  author: 'NocoDB',
  order: 3,
});
