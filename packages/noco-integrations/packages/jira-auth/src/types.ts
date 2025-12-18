import type { AuthType } from '@noco-integrations/core';

export interface JiraAuthConfig {
  type: AuthType;
  token?: string;
  email?: string;
  jira_url: string;
  oauth_token?: string;
  refresh_token?: string;
  expires_in?: number;
}
