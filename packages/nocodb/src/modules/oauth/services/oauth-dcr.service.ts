import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { OAuthClientType } from 'nocodb-sdk';
import { OAuthClient } from '~/models';

export interface DcrRegistrationRequest {
  redirect_uris: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  grant_types?: string[];
  response_types?: string[];
  client_type?: OAuthClientType;
}

@Injectable()
export class OauthDcrService {
  async registerClient(request: DcrRegistrationRequest) {
    if (
      !request.redirect_uris ||
      !Array.isArray(request.redirect_uris) ||
      request.redirect_uris.length === 0
    ) {
      throw new Error(
        'invalid_client_metadata: redirect_uris is required and must be a non-empty array',
      );
    }

    for (const uri of request.redirect_uris) {
      if (!this.isValidRedirectUri(uri)) {
        throw new Error(
          'invalid_redirect_uri: redirect_uris must use HTTPS or be localhost',
        );
      }
    }

    const supportedGrantTypes = ['authorization_code', 'refresh_token'];
    const grantTypes = request.grant_types || ['authorization_code'];
    for (const grantType of grantTypes) {
      if (!supportedGrantTypes.includes(grantType)) {
        throw new Error(
          `invalid_client_metadata: unsupported grant_type: ${grantType}`,
        );
      }
    }

    const supportedResponseTypes = ['code'];
    const responseTypes = request.response_types || ['code'];
    for (const responseType of responseTypes) {
      if (!supportedResponseTypes.includes(responseType)) {
        throw new Error(
          `invalid_client_metadata: unsupported response_type: ${responseType}`,
        );
      }
    }

    const clientType = request.client_type || OAuthClientType.CONFIDENTIAL;
    if (
      ![OAuthClientType.PUBLIC, OAuthClientType.CONFIDENTIAL].includes(
        clientType,
      )
    ) {
      throw new Error(
        'invalid_client_metadata: client_type must be "public" or "confidential"',
      );
    }

    const clientSecret =
      clientType === OAuthClientType.CONFIDENTIAL
        ? randomBytes(32).toString('base64url')
        : undefined;
    const issuedAt = Math.floor(Date.now() / 1000);

    const clientData = {
      client_secret: clientSecret,
      client_name: request.client_name || 'Dynamically Registered Client',
      client_uri: request.client_uri,
      redirect_uris: request.redirect_uris,
      client_type: clientType,
      grant_types: grantTypes,
      response_types: responseTypes,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: clientSecret ? 0 : undefined, // 0 means never expires
    };

    const res = await OAuthClient.insert(clientData);

    return {
      client_id: res.client_id,
      client_secret: clientSecret,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: clientSecret ? 0 : undefined,
      redirect_uris: request.redirect_uris,
      client_name: request.client_name,
      client_uri: request.client_uri,
      logo_uri: request.logo_uri,
      client_type: clientType,
      grant_types: grantTypes,
      response_types: responseTypes,
    };
  }

  private isValidRedirectUri(uri: string): boolean {
    try {
      const url = new URL(uri);

      if (url.protocol === 'https:') {
        return true;
      }

      return (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '::1'
      );
    } catch {
      return false;
    }
  }
}
