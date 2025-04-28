import axios from 'axios';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export const scopes = ['read', 'write'];
export const clientId = process.env.INTEGRATION_AUTH_LINEAR_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_LINEAR_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_LINEAR_REDIRECT_URI;

export default class LinearAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials,
  ): Promise<AuthResponse> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          accessToken: payload.token,
          authType: AuthType.Bearer,
        };
      case AuthType.OAuth:
        return {
          accessToken: payload.oauth_token,
          authType: AuthType.Bearer,
        };
      default:
        throw new Error('Not implemented');
    }
  }

  public async exchangeToken(payload: { code: string }): Promise<{
    oauth_token: string;
  }> {
    const response = await axios.post(
      'https://api.linear.app/oauth/token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: payload.code,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
}
