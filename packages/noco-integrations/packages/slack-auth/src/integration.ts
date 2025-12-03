import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type { AxiosError } from 'axios';
import type { SlackAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class SlackAuthIntegration extends AuthIntegration<
  SlackAuthConfig,
  WebClient
> {
  public client: WebClient | null = null;

  /**
   * Authenticate and initialize the Slack WebClient
   */
  public async authenticate(): Promise<WebClient> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        this.client = new WebClient(this.config.token);
        return this.client;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('OAuth token is required for OAuth authentication');
        }
        this.client = new WebClient(this.config.oauth_token);
        return this.client;

      default:
        throw new Error('Unsupported authentication type');
    }
  }

  /**
   * Test connection to Slack API
   */
  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (client) => {
        await client.auth.test();
      });

      return {
        success: true,
      };
    } catch (error: any) {
      const slackError = error?.data?.error;

      if (slackError === 'invalid_auth') {
        return {
          success: false,
          message: 'Invalid token or unauthorized access',
        };
      }

      if (slackError === 'account_inactive') {
        return {
          success: false,
          message: 'Slack account is inactive',
        };
      }

      if (slackError === 'token_revoked') {
        return {
          success: false,
          message: 'Token has been revoked',
        };
      }

      if (slackError === 'token_expired') {
        return {
          success: false,
          message: 'Token has expired. Please refresh the token.',
        };
      }

      if (slackError === 'not_authed') {
        return {
          success: false,
          message: 'No authentication token provided',
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
   * Exchange OAuth authorization code for access token
   * This happens after user authorizes the app
   */
  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string; // Not used by Slack, kept for interface compatibility
  }): Promise<{ oauth_token: string; refresh_token?: string }> {
    const { code } = payload;

    if (!code) {
      throw new Error('Authorization code is required');
    }

    try {
      const response = await axios.post(
        tokenUri,
        new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri!,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Token exchange failed');
      }

      const userToken = response.data.authed_user?.access_token;
      const refreshToken = response.data.authed_user?.refresh_token;

      if (!userToken) {
        throw new Error(
          'No user access token received from Slack. Ensure you request user_scope parameter in the OAuth authorization URL.',
        );
      }

      return {
        oauth_token: userToken,
        refresh_token: refreshToken,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const slackError = (axiosError.response?.data as unknown as any)?.error;

        if (slackError) {
          throw new Error(`Slack OAuth error: ${slackError}`);
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to exchange Slack authorization code: ${message}`,
      );
    }
  }

  /**
   * Refresh an expired OAuth user token using the refresh token
   * Only works if token rotation is enabled in Slack app settings
   * Note: Bot tokens (ApiKey type) are long-lived and never expire, so no refresh is needed
   */
  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    const { refresh_token } = payload;

    if (!refresh_token) {
      throw new Error('Refresh token is required');
    }

    try {
      const response = await axios.post(
        tokenUri,
        new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: 'refresh_token',
          refresh_token,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Token refresh failed');
      }

      // For user token refresh (OAuth type)
      if (!response.data.authed_user) {
        throw new Error('No user token in refresh response');
      }

      return {
        oauth_token: response.data.authed_user.access_token,
        refresh_token: response.data.authed_user.refresh_token,
        expires_in: response.data.authed_user.expires_in,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const slackError = (axiosError.response?.data as unknown as any)?.error;

        if (slackError === 'invalid_refresh_token') {
          throw new Error(
            'Invalid refresh token. User needs to re-authenticate.',
          );
        }

        if (slackError) {
          throw new Error(`Slack token refresh error: ${slackError}`);
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh Slack token: ${message}`);
    }
  }

  /**
   * Determine if an error indicates token expiration or invalidity
   * Overrides base class method with Slack-specific logic
   *
   * Note: Only OAuth user tokens can expire (if token rotation is enabled).
   * Bot tokens (ApiKey type) are long-lived and won't trigger refresh.
   */
  protected shouldRefreshToken(err: any): boolean {
    // Only OAuth tokens need refreshing (bot tokens never expire)
    if (this.config.type !== AuthType.OAuth) {
      return false;
    }

    // Check if refresh token is available
    if (!this.config.refresh_token) {
      return false;
    }

    // Check Slack-specific error codes
    const slackError = err?.data?.error;
    if (slackError) {
      return (
        slackError === 'token_expired' ||
        slackError === 'invalid_auth' ||
        slackError === 'token_revoked'
      );
    }

    // Fallback to HTTP status codes
    const status = err?.response?.status || err?.status;
    return status === 401;
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.client = null;
  }
}
