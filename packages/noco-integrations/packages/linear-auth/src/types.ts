import type { AuthType } from '@noco-integrations/core'

interface LinearApiKeyConfig {
  type: AuthType.ApiKey;
  token: string;
}

interface LinearOAuthConfig {
  type: AuthType.OAuth;
  oauth_token: string;
  refresh_token: string;
  expires_in?: number;
}

type LinearAuthConfig = LinearApiKeyConfig | LinearOAuthConfig;

export {
  LinearAuthConfig
}