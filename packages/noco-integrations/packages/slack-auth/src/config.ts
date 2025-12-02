// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_SLACK_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_SLACK_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_SLACK_REDIRECT_URI;

// OAuth scopes - based on n8n's scopes
export const scopes = [
  'channels:read',
  'channels:write',
  'channels:history',
  'chat:write',
  'files:read',
  'files:write',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'reactions:read',
  'reactions:write',
  'stars:read',
  'stars:write',
  'usergroups:write',
  'usergroups:read',
  'users.profile:read',
  'users.profile:write',
  'users:read',
  'search:read',
];

// OAuth URIs
export const authUri =
  clientId && redirectUri
    ? `https://slack.com/oauth/v2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes.join(','))}&user_scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://slack.com/api/oauth.v2.access';
