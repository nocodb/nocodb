export const clientId = process.env.INTEGRATION_AUTH_GOOGLE_CALENDAR_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_GOOGLE_CALENDAR_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_GOOGLE_CALENDAR_REDIRECT_URI;

export const scopes = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const authUri =
  clientId && redirectUri
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&access_type=offline&prompt=consent`
    : '';

export const tokenUri = 'https://oauth2.googleapis.com/token';
