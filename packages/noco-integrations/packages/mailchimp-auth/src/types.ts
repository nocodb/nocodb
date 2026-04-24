import type { AuthType } from '@noco-integrations/core';

export interface MailchimpAuthConfig {
  type: AuthType;
  // OAuth fields
  oauth_token?: string;
  refresh_token?: string;
  expires_in?: number;
  // API Key fields
  apiKey?: string;
  // Shared
  server?: string; // datacenter prefix, e.g. "us21"
  mandrillApiKey?: string; // optional, for transactional email
}
