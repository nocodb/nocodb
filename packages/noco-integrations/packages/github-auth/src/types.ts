import type { AuthType } from '@noco-integrations/core';

interface GithubApiKeyConfig {
  type: AuthType.ApiKey;
  token: string;
}

interface GithubOAuthConfig {
  type: AuthType.OAuth;
  oauth_token: string;
  refresh_token?: string;
}

export type GithubAuthConfig = GithubApiKeyConfig | GithubOAuthConfig;
