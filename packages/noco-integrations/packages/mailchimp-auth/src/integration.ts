import axios from 'axios';
import mailchimp from '@mailchimp/mailchimp_marketing';
import Mandrill from '@mailchimp/mailchimp_transactional';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri, metadataUri } from './config';
import { APP_LABEL } from './constant';
import type { RateLimitOptions } from '@noco-integrations/core';
import type { TestConnectionResponse } from '@noco-integrations/core';
import type { MailchimpAuthConfig } from './types';

export class MailchimpAuthIntegration extends AuthIntegration<
  MailchimpAuthConfig,
  typeof mailchimp
> {
  public client: typeof mailchimp | null = null;

  private mandrillClient: ReturnType<typeof Mandrill> | null = null;

  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 10,
        perMilliseconds: 1000,
      },
      maxQueueSize: 100,
    };
  }

  public async authenticate(): Promise<typeof mailchimp> {
    let apiKey: string;
    let server: string;

    switch (this.config.type) {
      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error(`Missing required ${APP_LABEL} OAuth token`);
        }
        if (!this.config.server) {
          throw new Error(`Missing required ${APP_LABEL} server prefix`);
        }
        apiKey = this.config.oauth_token;
        server = this.config.server;

        mailchimp.setConfig({
          accessToken: apiKey,
          server,
        });
        break;

      case AuthType.ApiKey:
        if (!this.config.apiKey) {
          throw new Error(`Missing required ${APP_LABEL} API key`);
        }
        // API key format: "key-us21" — extract server from suffix
        const parts = this.config.apiKey.split('-');
        if (parts.length < 2) {
          throw new Error(
            'Invalid API key format. Expected format: "apikey-us21"',
          );
        }
        apiKey = this.config.apiKey;
        server = parts[parts.length - 1];

        mailchimp.setConfig({
          apiKey,
          server,
        });
        break;

      default:
        throw new Error(`Unsupported auth type: ${this.config.type}`);
    }

    this.client = mailchimp;
    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      return await this.use(async (client) => {
        await client.ping.get();
        return { success: true };
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
  }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
    server?: string;
  }> {
    const { code } = payload;

    // Exchange code for access token
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri!);
    params.append('client_id', clientId!);
    params.append('client_secret', clientSecret!);

    const tokenResponse = await axios.post(tokenUri, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // Fetch metadata to get datacenter (server prefix)
    const metadataResponse = await axios.get(metadataUri, {
      headers: {
        Authorization: `OAuth ${accessToken}`,
      },
    });

    const server = metadataResponse.data.dc;

    return {
      oauth_token: accessToken,
      server,
    };
  }

  /**
   * Mailchimp OAuth tokens do not expire, so refresh is a no-op.
   */
  shouldRefreshToken(_err: any) {
    return false;
  }

  /**
   * Returns a Mandrill transactional client.
   * Requires `mandrillApiKey` in the auth config.
   */
  public getMandrillClient(): ReturnType<typeof Mandrill> {
    if (this.mandrillClient) {
      return this.mandrillClient;
    }

    if (!this.config.mandrillApiKey) {
      throw new Error(
        'Mandrill API key is not configured. Add it in the Mailchimp integration settings to use transactional email.',
      );
    }

    this.mandrillClient = Mandrill(this.config.mandrillApiKey);
    return this.mandrillClient;
  }
}
