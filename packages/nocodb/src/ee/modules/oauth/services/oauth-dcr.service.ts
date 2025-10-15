import { Injectable } from '@nestjs/common';
import { OAuthClientType, PublicAttachmentScope } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OAuthClient } from '~/models';
import { AttachmentsService } from '~/services/attachments.service';

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
  constructor(private readonly attachmentsService: AttachmentsService) {}

  async registerClient(request: DcrRegistrationRequest, req: NcRequest) {
    if (!request.redirect_uris) {
      throw new Error('invalid_redirect_uri: redirect_uris is required');
    }

    if (request.redirect_uris.length === 0) {
      throw new Error('invalid_redirect_uri: redirect_uris cannot be empty');
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

    const issuedAt = Math.floor(Date.now() / 1000);

    let uploadedLogoUri = null;
    if (request.logo_uri) {
      try {
        const attachments = await this.attachmentsService.uploadViaURL({
          urls: [{ url: request.logo_uri }],
          req,
          scope: PublicAttachmentScope.OAUTHCLIENTS,
        });

        if (attachments && attachments.length > 0) {
          uploadedLogoUri = attachments[0];
        }
      } catch (error) {
        throw new Error(
          `invalid_client_metadata: Failed to upload logo: ${error.message}`,
        );
      }
    }

    const clientData = {
      client_name: request.client_name || 'Dynamically Registered Client',
      client_uri: request.client_uri,
      redirect_uris: request.redirect_uris,
      client_type: clientType,
      grant_types: grantTypes,
      response_types: responseTypes,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      logo_uri: uploadedLogoUri,
    };

    const res = await OAuthClient.insert(clientData);

    const response: any = {
      client_id: res.client_id,
      client_id_issued_at: res.client_id_issued_at,
      client_secret_expires_at: res.client_secret_expires_at,
      redirect_uris: res.redirect_uris,
      client_name: res.client_name,
      client_uri: res.client_uri,
      client_type: res.client_type,
      grant_types: res.allowed_grant_types,
      response_types: res.response_types,
    };

    if (clientType === OAuthClientType.CONFIDENTIAL && res.client_secret) {
      response.client_secret = res.client_secret;
    }

    if (uploadedLogoUri) {
      response.logo_uri = uploadedLogoUri;
    }

    return response;
  }

  private isValidRedirectUri(uri: string): boolean {
    try {
      const url = new URL(uri);

      // Reject URIs with fragments
      if (url.hash) {
        return false;
      }

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
