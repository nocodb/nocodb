export const clientId = process.env.INTEGRATION_AUTH_MAILCHIMP_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_MAILCHIMP_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_MAILCHIMP_REDIRECT_URI;

export const scopes: string[] = [];

export const authUri =
  clientId && redirectUri
    ? `https://login.mailchimp.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
    : '';

export const tokenUri = 'https://login.mailchimp.com/oauth2/token';
export const metadataUri = 'https://login.mailchimp.com/oauth2/metadata';
