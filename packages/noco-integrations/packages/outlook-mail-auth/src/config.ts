export const clientId = process.env.INTEGRATION_AUTH_OUTLOOK_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_OUTLOOK_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_OUTLOOK_REDIRECT_URI;
export const tenantId =
  process.env.INTEGRATION_AUTH_OUTLOOK_TENANT_ID || 'common';

export const scopes = [
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/MailboxSettings.Read',
  'https://graph.microsoft.com/User.ReadBasic.All',
];

export const authUri =
  clientId && redirectUri
    ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&response_mode=query&prompt=consent`
    : '';

export const tokenUri = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
