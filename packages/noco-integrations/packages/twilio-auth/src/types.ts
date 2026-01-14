import type { AuthType } from '@noco-integrations/core';

export interface TwilioAuthConfig {
  type: AuthType.ApiKey;
  accountSid: string;
  authToken: string;
}
