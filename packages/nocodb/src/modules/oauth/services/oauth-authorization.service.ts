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
    workspaceId?: string;
    baseId?: string;
  }): Promise<OAuthAuthorizationCode> {
    const {
      clientId,
      userId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod = 'S256',
      scope,
      workspaceId,
      baseId,
    } = params;

    const client = await OAuthClient.getByClientId(clientId);
    if (!client) {
      NcError.badRequest('invalid_client');
    }

    // Validate redirect URI inline
    if (!redirectUri) {
      NcError.badRequest('invalid_redirect_uri');
    }

    try {
      const url = new URL(redirectUri);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        NcError.badRequest('invalid_redirect_uri');
      }
      // Exact match required for security
      if (!client.redirect_uris.includes(redirectUri)) {
        NcError.badRequest('invalid_redirect_uri');
      }
    } catch {
      NcError.badRequest('invalid_redirect_uri');
    }

    // Validate state inline
    if (state) {
      if (state.length < 16 || state.length > 1024) {
        NcError.badRequest('invalid_state');
      }
      const allowedChars = /^[a-zA-Z0-9._-]+$/;
      if (!allowedChars.test(state)) {
        NcError.badRequest('invalid_state');
      }
    }

    // Validate code challenge inline
    if (!codeChallenge) {
      NcError.badRequest('code_challenge_required');
    }

    if (codeChallengeMethod !== 'S256') {
      NcError.badRequest('invalid_code_challenge');
    }

    if (codeChallenge.length !== 43) {
      NcError.badRequest('invalid_code_challenge');
    }

    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    if (!base64urlPattern.test(codeChallenge)) {
      NcError.badRequest('invalid_code_challenge');
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const grantedResources: Record<string, any> = {};
    if (workspaceId) {
      grantedResources.workspace_id = workspaceId;
    }
    if (baseId) {
      grantedResources.base_id = baseId;
    }

    return await OAuthAuthorizationCode.insert({
      client_id: clientId,
      user_id: userId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
      granted_resources:
        Object.keys(grantedResources).length > 0 ? grantedResources : null,
      expires_at: expiresAt.toISOString(),
    });
  }
}
