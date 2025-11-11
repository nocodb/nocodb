import type { AuthType } from '@noco-integrations/core';

interface GitlabApiKeyConfig {
  type: AuthType.ApiKey;
  token: string;
  hostname?: string;
}

interface GitlabOAuthConfig {
  type: AuthType.OAuth;
  oauth_token: string;
  refresh_token: string;
  hostname?: string;
}

type GitlabAuthConfig = GitlabApiKeyConfig | GitlabOAuthConfig;

export { GitlabAuthConfig };
