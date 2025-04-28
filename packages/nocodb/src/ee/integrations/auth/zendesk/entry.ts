import axios from 'axios';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export const scopes = ['read', 'tickets:read'];
export const clientId = process.env.INTEGRATION_AUTH_ZENDESK_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_ZENDESK_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_ZENDESK_REDIRECT_URI;

export default class ZendeskAuthIntegration extends AuthIntegration {
  public async authenticate(payload: AuthCredentials): Promise<AuthResponse> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          access_token: payload.token,
        };
      case AuthType.OAuth:
        return {
          access_token: payload.oauth_token,
        };
      default:
        throw new Error('Not implemented');
    }
  }

  public async exchangeToken(payload: {
    code: string;
    subdomain: string;
  }): Promise<{
    oauth_token: string;
  }> {
    const response = await axios.post(
      `https://${payload.subdomain}.zendesk.com/oauth/tokens`,
      {
        grant_type: 'authorization_code',
        code: payload.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
}
