import type { AuthType } from '@noco-integrations/core'

interface ZohoApiKeyConfig {
  type: AuthType.ApiKey;
  region: string;
  token: string;
}

interface ZohoOAuthConfig {
  type: AuthType.OAuth;
  region: string;
  oauth_token: string;
  refresh_token: string;
  expires_in?: number;
}

type ZohoAuthConfig = ZohoApiKeyConfig | ZohoOAuthConfig;

export {
  ZohoAuthConfig
}