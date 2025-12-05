import type { AuthType } from '@noco-integrations/core';

export interface DropboxAuthConfig {
  type: AuthType;
  token?: string;
  oauth_token?: string;
  refresh_token?: string;
  expires_in?: number;
}
