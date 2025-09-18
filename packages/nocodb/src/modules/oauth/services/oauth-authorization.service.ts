import { Injectable } from '@nestjs/common';
import { OAuthAuthorizationCode, OAuthClient } from '~/models';
import { NcError } from '~/helpers/ncError';

@Injectable()
export class OauthAuthorizationService {
  buildRedirectUrl(redirectUri: string, params: Record<string, string>) {
    const url = new URL(redirectUri);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }
  async createAuthorizationCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    scope?: string;
  }): Promise<OAuthAuthorizationCode> {
    const {
      clientId,
      userId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod = 'S256',
      scope,
    } = params;

    const client = await OAuthClient.getByClientId(clientId);
    if (!client) {
      NcError.notFound('Invalid client_id');
    }

    if (!client.redirect_uris.includes(redirectUri)) {
      NcError.notFound('Invalid redirect_uri');
    }

    return await OAuthAuthorizationCode.insert({
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
    });
  }
}
