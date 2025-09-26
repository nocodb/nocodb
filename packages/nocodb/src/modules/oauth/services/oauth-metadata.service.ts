import { Injectable } from '@nestjs/common';
import type { NcRequest } from 'nocodb-sdk/build/main/lib';

@Injectable()
export class OauthMetadataService {
  constructor() {}

  getAuthorizationServerMetadata(req: NcRequest) {
    const baseUrl = req.ncSiteUrl;

    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/v2/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/v2/oauth/token`,
      revocation_endpoint: `${baseUrl}/api/v2/oauth/revoke`,
      registration_endpoint: `${baseUrl}/api/v2/oauth/register`,
      scopes_supported: [],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      revocation_endpoint_auth_methods_supported: [
        'none',
        'client_secret_post',
      ],
      resource_parameter_supported: true,
      code_challenge_methods_supported: ['S256'],
      service_documentation: `https://nocodb.com/docs/api-docs`,
      ui_locales_supported: ['en'],
    };
  }

  /**
   * Get OAuth 2.0 Protected Resource Metadata (RFC 9728)
   */
  getProtectedResourceMetadata(req: NcRequest) {
    const baseUrl = req.ncSiteUrl;

    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: [],
      bearer_methods_supported: ['header'],
      resource_documentation: `https://nocodb.com/docs`,
    };
  }

  /**
   * Generate WWW-Authenticate header for 401 responses (RFC 9728 Section 5.1)
   */
  generateWwwAuthenticateHeader(req: NcRequest): string {
    const baseUrl = req.ncSiteUrl;
    const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

    return `Bearer realm="${baseUrl}", resource_metadata="${resourceMetadataUrl}"`;
  }
}
