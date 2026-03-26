import { Injectable } from '@nestjs/common';
import { OAuthScopes } from 'nocodb-sdk';

export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
}

@Injectable()
export class OauthDiscoveryService {
  getMetadata(issuer: string): OAuthServerMetadata {
    const base = issuer.replace(/\/+$/, '');

    return {
      issuer: base,
      authorization_endpoint: `${base}/api/v2/oauth/authorize`,
      token_endpoint: `${base}/api/v2/oauth/token`,
      revocation_endpoint: `${base}/api/v2/oauth/revoke`,
      registration_endpoint: `${base}/api/v2/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: Object.values(OAuthScopes),
    };
  }
}
