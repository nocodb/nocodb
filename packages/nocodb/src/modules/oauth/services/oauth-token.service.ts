import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { OAuthAuthorizationCode, OAuthClient, OAuthToken } from '~/models';
import { NcError } from '~/helpers/ncError';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface PKCEValidationParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

@Injectable()
export class OauthTokenService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly ACCESS_TOKEN_EXPIRES_IN = 3600; // 1 hour in seconds
  private readonly REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 3600; // 7 days in seconds

  validatePKCE(params: PKCEValidationParams): boolean {
    const { codeVerifier, codeChallenge, codeChallengeMethod } = params;

    if (!codeChallenge || !codeVerifier) {
      return false;
    }

    let computedChallenge: string;

    switch (codeChallengeMethod) {
      case 'S256':
        computedChallenge = createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');
        break;
      case 'plain':
        computedChallenge = codeVerifier;
        break;
      default:
        return false;
    }

    return computedChallenge === codeChallenge;
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('base64url');
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(payload: {
    userId: string;
    clientId: string;
    scope?: string;
  }): string {
    return jwt.sign(
      {
        sub: payload.userId,
        client_id: payload.clientId,
        scope: payload.scope,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.ACCESS_TOKEN_EXPIRES_IN,
      },
      this.JWT_SECRET,
      {
        algorithm: 'HS256',
      },
    );
  }

  /**
   * Exchange authorization code for tokens (with PKCE validation)
   */
  async exchangeCodeForTokens(params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<TokenResponse> {
    const { code, clientId, redirectUri, codeVerifier } = params;

    // Get authorization code
    const authCode = await OAuthAuthorizationCode.getByCode(code);
    if (!authCode) {
      throw NcError.badRequest('Invalid or expired authorization code');
    }

    // Check if code is already used
    if (authCode.is_used) {
      throw NcError.badRequest('Authorization code has already been used');
    }

    // Check if code is expired
    if (new Date(authCode.expires_at) < new Date()) {
      throw NcError.badRequest('Authorization code has expired');
    }

    // Validate client ID
    if (authCode.client_id !== clientId) {
      throw NcError.badRequest('Invalid client_id');
    }

    // Validate redirect URI
    if (authCode.redirect_uri !== redirectUri) {
      throw NcError.badRequest('Invalid redirect_uri');
    }

    // Validate PKCE if code challenge was provided during authorization
    if (authCode.code_challenge) {
      if (!codeVerifier) {
        throw NcError.badRequest('code_verifier is required for PKCE');
      }

      const isValidPKCE = this.validatePKCE({
        codeVerifier,
        codeChallenge: authCode.code_challenge,
        codeChallengeMethod: authCode.code_challenge_method,
      });

      if (!isValidPKCE) {
        throw NcError.badRequest('Invalid code_verifier');
      }
    }

    // Get client to verify it exists
    const client = await OAuthClient.getByClientId(clientId);
    if (!client) {
      throw NcError.badRequest('Invalid client');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken({
      userId: authCode.user_id,
      clientId: authCode.client_id,
      scope: authCode.scope,
    });

    const refreshToken = this.generateSecureToken(64);

    const accessTokenExpiresAt = new Date(
      Date.now() + this.ACCESS_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    const refreshTokenExpiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    // Store token in database
    await OAuthToken.insert({
      client_id: clientId,
      fk_user_id: authCode.user_id,
      access_token: accessToken,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token: refreshToken,
      refresh_token_expires_at: refreshTokenExpiresAt,
      scope: authCode.scope,
      granted_resources: authCode.granted_resources,
      resource: authCode.resource,
    });

    // Mark authorization code as used
    await OAuthAuthorizationCode.markAsUsed(code);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_EXPIRES_IN,
      refresh_token: refreshToken,
      scope: authCode.scope,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(params: {
    refreshToken: string;
    clientId: string;
  }): Promise<TokenResponse> {
    const { refreshToken, clientId } = params;

    // Get token by refresh token
    const tokenRecord = await OAuthToken.getByRefreshToken(refreshToken);
    if (!tokenRecord) {
      throw NcError.badRequest('Invalid refresh token');
    }

    // Check if token is revoked
    if (tokenRecord.is_revoked) {
      throw NcError.badRequest('Refresh token has been revoked');
    }

    // Check if refresh token is expired
    if (
      tokenRecord.refresh_token_expires_at &&
      new Date(tokenRecord.refresh_token_expires_at) < new Date()
    ) {
      throw NcError.badRequest('Refresh token has expired');
    }

    // Validate client ID
    if (tokenRecord.client_id !== clientId) {
      throw NcError.badRequest('Invalid client_id');
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken({
      userId: tokenRecord.fk_user_id,
      clientId: tokenRecord.client_id,
      scope: tokenRecord.scope,
    });

    const newAccessTokenExpiresAt = new Date(
      Date.now() + this.ACCESS_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

    // Generate new refresh token (rotate refresh tokens for security)
    const newRefreshToken = this.generateSecureToken(64);
    const newRefreshTokenExpiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRES_IN * 1000,
    ).toISOString();

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
      scope: tokenRecord.scope,
    };
  }

  /**
   * Revoke a token (access or refresh)
   */
  async revokeToken(params: {
    token: string;
    clientId: string;
    tokenTypeHint?: 'access_token' | 'refresh_token';
  }): Promise<boolean> {
    const { token, clientId, tokenTypeHint } = params;

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
      // OAuth spec says to return success even if token doesn't exist
      return true;
    }

    // Validate client ID
    if (tokenRecord.client_id !== clientId) {
      throw NcError.badRequest('Invalid client_id');
    }

    // Revoke the token
    await OAuthToken.revoke(tokenRecord.id);

    return true;
  }
}
