import axios from 'axios';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export const scopes = ['read:jira-work', 'read:jira-user'];
export const clientId = process.env.INTEGRATION_AUTH_JIRA_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_JIRA_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_JIRA_REDIRECT_URI;

export default class JiraAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials,
  ): Promise<AuthResponse<any>> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          custom: {
            token: payload.token,
            domain: payload.domain,
            email: payload.email,
          },
        };
      case AuthType.OAuth:
        return {
          custom: {
            token: payload.oauth_token,
            domain: payload.domain,
          },
        };
      default:
        throw new Error('Not implemented');
    }
  }

  public async exchangeToken(payload: {
    code: string;
    domain: string;
  }): Promise<{
    oauth_token: string;
    domain: string;
  }> {
    const response = await axios.post(
      'https://auth.atlassian.com/oauth/token',
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
      domain: payload.domain,
    };
  }
}
