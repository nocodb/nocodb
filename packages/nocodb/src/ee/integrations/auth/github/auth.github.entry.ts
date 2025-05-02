import { Octokit } from 'octokit';
import axios from 'axios';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export const scopes = ['read:user', 'repo'];
export const clientId = process.env.INTEGRATION_AUTH_GITHUB_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_GITHUB_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_GITHUB_REDIRECT_URI;

export default class GithubAuthIntegration extends AuthIntegration {
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

  public async exchangeToken(payload: { code: string }): Promise<{
    oauth_token: string;
  }> {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
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
