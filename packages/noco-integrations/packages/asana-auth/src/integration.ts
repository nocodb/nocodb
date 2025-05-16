import axios from 'axios';
import * as asana from 'asana';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type { AuthResponse } from '@noco-integrations/core';

export class AsanaAuthIntegration extends AuthIntegration {
  public async authenticate(): Promise<AuthResponse<asana.Client>> {
    let client;

    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Asana API token');
        }

        client = asana.Client.create();
        client.useAccessToken(this.config.token);

        return {
          custom: client,
        };
      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Asana OAuth token');
        }

        client = asana.Client.create();
        client.useAccessToken(this.config.oauth_token);

        return {
          custom: client,
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
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
}
