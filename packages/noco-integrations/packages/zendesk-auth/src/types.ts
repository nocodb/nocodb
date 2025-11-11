import type { AuthType } from '@noco-integrations/core'

interface ZendeskApiKeyConfig {
  type: AuthType.ApiKey;
  subdomain: string;
  email: string;
  token: string;
}

interface ZendeskOAuthConfig {
  type: AuthType.OAuth;
  subdomain: string;
  oauth_token: string;
  refresh_token: string;
  expires_in?: number;
}

type ZendeskAuthConfig = ZendeskApiKeyConfig | ZendeskOAuthConfig;

export {
  ZendeskAuthConfig
}