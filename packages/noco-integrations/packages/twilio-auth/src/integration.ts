import Twilio from 'twilio';
import { AuthIntegration } from '@noco-integrations/core';
import type { TwilioAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

type TwilioClient = ReturnType<typeof Twilio>;

export class TwilioAuthIntegration extends AuthIntegration<
  TwilioAuthConfig,
  TwilioClient
> {
  public client: TwilioClient | null = null;

  /**
   * Authenticate and initialize the Twilio client
   */
  public async authenticate(): Promise<TwilioClient> {
    this.client = Twilio(this.config.accountSid, this.config.authToken);
    return this.client;
  }

  /**
   * Test connection to Twilio API
   */
  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (client) => {
        await client.api.accounts(this.config.accountSid).fetch();
      });

      return {
        success: true,
      };
    } catch (error: any) {
      const statusCode = error?.status;

      if (statusCode === 401) {
        return {
          success: false,
          message: 'Invalid Account SID or Auth Token',
        };
      }

      if (statusCode === 404) {
        return {
          success: false,
          message: 'Account not found',
        };
      }

      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.client = null;
  }
}
