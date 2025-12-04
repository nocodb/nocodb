// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_SLACK_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_SLACK_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_SLACK_REDIRECT_URI;

// Bot scopes - for bot token operations
export const botScopes = [
  'chat:write', // Send messages as bot
  'channels:read', // List public channels for dropdown
  'groups:read', // List private channels for dropdown
  'users:read', // List users for dropdown
  'im:write', // Send direct messages to users
  'chat:write.customize', // Customize bot name and icon when sending messages
];

export const userScopes: string[] = [];

export const scopes = botScopes;

export const authUri =
  clientId && redirectUri
    ? `https://slack.com/oauth/v2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(botScopes.join(','))}`
    : '';

export const tokenUri = 'https://slack.com/api/oauth.v2.access';
