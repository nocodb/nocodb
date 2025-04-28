import { Gitlab } from '@gitbeaker/rest';
import axios from 'axios';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '../auth.helpers';
import AuthIntegration from '../auth.interface';

export const scopes = ['api', 'read_user'];
export const clientId = process.env.INTEGRATION_AUTH_GITLAB_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_GITLAB_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_GITLAB_REDIRECT_URI;

export default class GitlabAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials,
  ): Promise<AuthResponse<InstanceType<typeof Gitlab>>> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          custom: new Gitlab({
            token: payload.token,
          }),
        };
      case AuthType.OAuth:
        return {
          custom: new Gitlab({
            oauthToken: payload.oauth_token,
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
      'https://gitlab.com/oauth/token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
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
