import { Octokit as CoreOctokit } from 'octokit';
import { throttling } from '@octokit/plugin-throttling';
import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type { ThrottlingOptions } from '@octokit/plugin-throttling';
import type { GithubAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

const Octokit = CoreOctokit.plugin(throttling);

export class GithubAuthIntegration extends AuthIntegration<
  GithubAuthConfig,
  CoreOctokit
> {
  public client: CoreOctokit | null = null;

  public async authenticate(): Promise<CoreOctokit> {
    const throttleObj: ThrottlingOptions = {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`,
        );

        // Retry once after rate limit
        if (retryCount < 1) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }

        return false;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Secondary rate limit detected for request ${options.method} ${options.url}`,
        );

        // Retry once for secondary rate limits
        if (retryCount < 1) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }

        return false;
      },
    };

    switch (this.config.type) {
      case AuthType.ApiKey:
        this.client = new Octokit({
          auth: this.config.token,
          throttle: throttleObj,
        });

        return this.client;
      case AuthType.OAuth:
        this.client = new Octokit({
          auth: this.config.oauth_token,
          throttle: throttleObj,
        });

        return this.client;
      default:
        throw new Error('Not implemented');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (octokit) => {
        await octokit.rest.users.getAuthenticated();
      });

      return {
        success: true,
      };
    } catch (error: any) {
      if (error?.status === 401) {
        return {
          success: false,
          message: 'Invalid token or unauthorized access',
        };
      }

      if (error?.status === 403) {
        return {
          success: false,
          message: 'Access forbidden - check token permissions or rate limit',
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string;
  }): Promise<{ oauth_token: string; refresh_token?: string }> {
    const { code, code_verifier } = payload;

    const params: any = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    };

    if (code_verifier) {
      params.code_verifier = code_verifier;
    }

    try {
      const response = await axios.post(tokenUri, params, {
        headers: {
          Accept: 'application/json',
        },
      });

      // GitHub OAuth tokens don't expire and don't have refresh tokens
      return {
        oauth_token: response.data.access_token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to exchange GitHub token: ${message}`);
    }
  }

  /**
   * Override shouldRefreshToken for GitHub since tokens don't expire
   */
  protected shouldRefreshToken(_err: any): boolean {
    // GitHub personal access tokens and OAuth tokens don't expire
    // Only refresh if explicitly revoked (401) and refresh token is available
    return false;
  }
}
