import axios from 'axios';
import { Gitlab } from '@gitbeaker/rest';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type { AuthResponse } from '@noco-integrations/core';

export class GitlabAuthIntegration extends AuthIntegration {
  public async authenticate(): Promise<AuthResponse<InstanceType<typeof Gitlab>>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        return {
          custom: new Gitlab({
            token: this.config.token,
          }),
        };
      case AuthType.OAuth:
        return {
          custom: new Gitlab({
            oauthToken: this.config.oauth_token,
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
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirect_uri,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
} 