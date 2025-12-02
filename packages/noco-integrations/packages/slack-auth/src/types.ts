import type { AuthType } from '@noco-integrations/core';

interface SlackApiKeyConfig {
  type: AuthType.ApiKey;
  token: string;
}

interface SlackOAuthConfig {
  type: AuthType.OAuth;
  oauth_token: string;
  refresh_token?: string;
}

export type SlackAuthConfig = SlackApiKeyConfig | SlackOAuthConfig;
