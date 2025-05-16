import axios from 'axios';
import { LinearClient } from '@linear/sdk';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type { AuthResponse } from '@noco-integrations/core';

export class LinearAuthIntegration extends AuthIntegration {
  public async authenticate(): Promise<AuthResponse<LinearClient>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Linear API token');
        }
        
        return {
          custom: new LinearClient({
            apiKey: this.config.token,
          }),
        };
      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Linear OAuth token');
        }
        
        return {
          custom: new LinearClient({
            accessToken: this.config.oauth_token,
          }),
        };
      default:
        throw new Error('Not implemented');
    }
  }

  public async exchangeToken(payload: {
    code: string;
  }): Promise<{ oauth_token: string }> {
    const response = await axios.post(
      tokenUri,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        redirect_uri: this.config.redirect_uri,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
} 