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
      case AuthType.ApiKey: {
        if (!payload.email) {
          throw new Error('Email is required for API token authentication');
        }
        // Format: base64({email}/token:{api_token})
        const credentials = Buffer.from(
          `${payload.email}/token:${payload.token}`,
        ).toString('base64');
        return {
          accessToken: credentials,
          authType: AuthType.ApiKey,
        };
      }
      case AuthType.OAuth:
        return {
          accessToken: payload.oauth_token,
          authType: AuthType.OAuth,
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
