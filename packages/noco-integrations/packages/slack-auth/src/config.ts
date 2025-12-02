// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_SLACK_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_SLACK_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_SLACK_REDIRECT_URI;

export const scopes = [
  'chat:write', // Send messages as the user
  'channels:read', // List public channels for dropdown
  'groups:read', // List private channels for dropdown
  'users:read', // List users for dropdown
  'im:write', // Send direct messages to users
  'chat:write.customize', // Customize bot name and icon when sending messages
];

// OAuth URIs
export const authUri =
  clientId && redirectUri
    ? `https://slack.com/oauth/v2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes.join(','))}&user_scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://slack.com/api/oauth.v2.access';
