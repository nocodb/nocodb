import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import {
  OAuthAuthorizationCode,
  OAuthClient,
  OAuthToken,
  User,
} from '~/models';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  resource?: string;
}

export interface PKCEValidationParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

@Injectable()
export class OauthTokenService {
  private readonly ACCESS_TOKEN_EXPIRES_IN = 60 * 60; // 1 hour in seconds
  private readonly REFRESH_TOKEN_EXPIRES_IN = 60 * 24 * 60 * 60; // 60 days in seconds

  validatePKCE(params: PKCEValidationParams): boolean {
    const { codeVerifier, codeChallenge, codeChallengeMethod } = params;

    if (!codeChallenge || !codeVerifier) {
      return false;
    }

    if (codeChallengeMethod !== 'S256') {
      return false;
    }

    if (codeVerifier.length < 43 || codeVerifier.length > 128) {
      return false;
    }
    const allowedChars = /^[a-zA-Z0-9._~-]+$/;
    if (!allowedChars.test(codeVerifier)) {
      return false;
    }

    const computedChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return computedChallenge === codeChallenge;
  }

  private generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('base64url');
  }

  private async generateAccessToken(payload: {
    userId: string;
    clientId: string;
    scope?: string;
  }): Promise<string> {
    const user = await User.get(payload.userId);
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        sub: payload.userId,
        client_id: payload.clientId,
        scope: payload.scope,
        iat: now,
        exp: now + this.ACCESS_TOKEN_EXPIRES_IN,
        // User information like normal JWTs
        email: user.email,
        id: user.id,
        roles: user.roles,
        token_version: user.token_version,
      },
      Noco.config.auth.jwt.secret,
      {
        algorithm: 'HS256',
      },
    );
  }

  private async authenticateClient(params: {
    clientId: string;
    clientSecret?: string;
  }): Promise<OAuthClient> {
    const { clientId, clientSecret } = params;

    const client = await OAuthClient.getByClientId(clientId);
    if (!client) {
      NcError.badRequest('invalid_client');
    }

    if (client.client_secret) {
      if (!clientSecret) {
        NcError.badRequest('invalid_client');
      }

      if (clientSecret !== client.client_secret) {
        NcError.badRequest('invalid_client');
      }
    } else {
      if (clientSecret) {
        NcError.badRequest('invalid_client');
      }
    }

    return client;
  }

  async exchangeCodeForTokens(params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier?: string;
    clientSecret?: string;
    resource?: string;
  }): Promise<TokenResponse> {
    const { code, clientId, redirectUri, codeVerifier, clientSecret } = params;

    // Get authorization code
    const authCode = await OAuthAuthorizationCode.getByCode(code);
    if (!authCode) {
      console.log('Invalid or expired authorization code');
      NcError.badRequest('Invalid or expired authorization code');
    }

    if (
      params.resource &&
      authCode.resource &&
      params.resource !== authCode.resource
    ) {
      console.log('resource parameter does not match authorized resource');
      NcError.badRequest(
        'resource parameter does not match authorized resource',
      );
    }

    // Check if code is already used
    if (authCode.is_used) {
      console.log('Authorization code has already been used');
      NcError.badRequest('Authorization code has already been used');
    }

    // Check if code is expired
    if (new Date(authCode.expires_at) < new Date()) {
      console.log('Authorization code has expired');
      NcError.badRequest('Authorization code has expired');
    }

    // Validate client ID
    if (authCode.client_id !== clientId) {
      console.log('Invalid client_id');
      NcError.badRequest('Invalid client_id');
    }

    // Validate redirect URI
    if (authCode.redirect_uri !== redirectUri) {
      console.log('Invalid redirect_uri');
      NcError.badRequest('Invalid redirect_uri');
    }

    // Validate PKCE if code challenge was provided during authorization
    if (authCode.code_challenge) {
      console.log('code_challenge is required for PKCE');
      if (!codeVerifier) {
        console.log('code_verifier is required for PKCE');
        NcError.badRequest('code_verifier is required for PKCE');
      }

      const isValidPKCE = this.validatePKCE({
        codeVerifier,
        codeChallenge: authCode.code_challenge,
        codeChallengeMethod: authCode.code_challenge_method,
      });

      if (!isValidPKCE) {
        console.log('Invalid code_verifier');
        NcError.badRequest('Invalid code_verifier');
      }
    } else {
      console.log('code_verifier is required for PKCE');
      NcError.badRequest('code_verifier is required for PKCE');
    }

    // Authenticate the client
    await this.authenticateClient({
      clientId,
      clientSecret,
    });

    console.log('Authenticated the client');
    const now = Date.now();
    const accessTokenExpiresAt = new Date(
      now + this.ACCESS_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    const refreshTokenExpiresAt = new Date(
      now + this.REFRESH_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    // Generate tokens
    const accessToken = await this.generateAccessToken({
      userId: authCode.user_id,
      clientId: authCode.client_id,
      scope: authCode.scope,
    });

    console.log('Generated access token');

    const refreshToken = randomBytes(64).toString('base64url');

    console.log('Generated refresh token');

    const insertObj = {
      client_id: clientId,
      fk_user_id: authCode.user_id,
      access_token: accessToken,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token: refreshToken,
      refresh_token_expires_at: refreshTokenExpiresAt,
      scope: authCode.scope,
      granted_resources: authCode.granted_resources,
      resource: authCode.resource,
    };

    console.log('Inserting token record');
    await OAuthToken.insert(insertObj);

    console.log('Marking authorization code as used');
    // Mark authorization code as used
    await OAuthAuthorizationCode.markAsUsed(code);

    console.log('Returning token response');
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_EXPIRES_IN,
      refresh_token: refreshToken,
      refresh_expires_in: this.REFRESH_TOKEN_EXPIRES_IN,
      scope: '',
      resource: authCode.resource,
    };
  }

  async refreshAccessToken(params: {
    refreshToken: string;
    clientId: string;
    clientSecret?: string;
    resource?: string;
  }): Promise<TokenResponse> {
    const { refreshToken, clientId, clientSecret } = params;

    // Get token by refresh token
    const tokenRecord = await OAuthToken.getByRefreshToken(refreshToken);
    if (!tokenRecord) {
      NcError.badRequest('Invalid refresh token');
    }

    // Check if token is revoked
    if (tokenRecord.is_revoked) {
      NcError.badRequest('Refresh token has been revoked');
    }

    // Check if refresh token is expired
    if (
      tokenRecord.refresh_token_expires_at &&
      new Date(tokenRecord.refresh_token_expires_at) < new Date()
    ) {
      NcError.badRequest('Refresh token has expired');
    }

    await this.authenticateClient({
      clientId,
      clientSecret,
    });

    // Validate client ID
    if (tokenRecord.client_id !== clientId) {
      NcError.badRequest('Invalid client_id');
    }

    const now = Date.now();
    const newAccessTokenExpiresAt = new Date(
      now + this.ACCESS_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    const newRefreshTokenExpiresAt = new Date(
      now + this.REFRESH_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    // Generate new access token
    const newAccessToken = await this.generateAccessToken({
      userId: tokenRecord.fk_user_id,
      clientId: tokenRecord.client_id,
      scope: tokenRecord.scope,
    });

    // Rotate refresh tokens for security
    const newRefreshToken = randomBytes(64).toString('base64url');

    // Revoke old token
    await OAuthToken.revoke(tokenRecord.id);

    // Create new token record
    await OAuthToken.insert({
      client_id: tokenRecord.client_id,
      fk_user_id: tokenRecord.fk_user_id,
      access_token: newAccessToken,
      access_token_expires_at: newAccessTokenExpiresAt,
      refresh_token: newRefreshToken,
      refresh_token_expires_at: newRefreshTokenExpiresAt,
      scope: tokenRecord.scope,
      granted_resources: tokenRecord.granted_resources,
      resource: tokenRecord.resource,
    });

    return {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_EXPIRES_IN,
      refresh_token: newRefreshToken,
      refresh_expires_in: this.REFRESH_TOKEN_EXPIRES_IN,
      scope: tokenRecord.scope,
    };
  }

  async revokeToken(params: {
    token: string;
    clientId: string;
    clientSecret?: string;
    tokenTypeHint?: 'access_token' | 'refresh_token';
  }): Promise<boolean> {
    const { token, clientId, clientSecret, tokenTypeHint } = params;

    // Authenticate the client
    await this.authenticateClient({
      clientId,
      clientSecret,
    });

    let tokenRecord: OAuthToken | null = null;

    // Try to find token based on hint or try both types
    if (tokenTypeHint === 'refresh_token') {
      tokenRecord = await OAuthToken.getByRefreshToken(token);
    } else {
      // Try access token first, then refresh token
      tokenRecord = await OAuthToken.getByAccessToken(token);
      if (!tokenRecord) {
        tokenRecord = await OAuthToken.getByRefreshToken(token);
      }
    }

    if (!tokenRecord) {
      // Return success even if token doesn't exist
      return true;
    }

    // Validate client ID
    if (tokenRecord.client_id !== clientId) {
      NcError.badRequest('Invalid client_id');
    }

    // Revoke the token
    await OAuthToken.revoke(tokenRecord.id);

    return true;
  }
}
