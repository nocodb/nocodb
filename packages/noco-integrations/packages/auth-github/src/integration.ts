import { Octokit } from 'octokit';
import axios from 'axios';
import {
  AuthCredentials,
  AuthIntegration,
  AuthResponse,
  AuthType,
} from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';

export class GithubAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials,
  ): Promise<AuthResponse<Octokit>> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          custom: new Octokit({
            auth: payload.token,
          }),
        };
      case AuthType.OAuth:
        return {
          custom: new Octokit({
            auth: payload.oauth_token,
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
