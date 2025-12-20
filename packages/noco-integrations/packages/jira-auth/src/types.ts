import type { AuthType } from '@noco-integrations/core';

export interface JiraAuthConfig {
  type: AuthType;
  token?: string;
  email?: string;
  jira_url: string;
  oauth_token?: string;
  jira_domain?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface AtlassianAccessibleResource {
  id: string; // Cloud ID
  name: string; // Site name
  url: string; // https://<site>.atlassian.net
  scopes: string[]; // Granted OAuth scopes
  avatarUrl?: string; // Optional
}
