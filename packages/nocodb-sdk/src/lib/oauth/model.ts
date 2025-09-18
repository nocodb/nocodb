import { AttachmentResType } from '~/lib';

export enum OAuthClientType {
  CONFIDENTIAL = 'confidential',
  PUBLIC = 'public',
}

export enum OAuthTokenEndpointAuthMethod {
  CLIENT_SECRET_BASIC = 'client_secret_basic',
  CLIENT_SECRET_POST = 'client_secret_post',
  NONE = 'none',
}

export enum OAuthConsentStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

export interface OAuthClient {
  client_id: string;
  client_secret?: string | null;
  client_type: OAuthClientType;

  client_name: string;
  client_uri?: string;
  logo_uri?: AttachmentResType;

  redirect_uris: string[];
  allowed_grant_types: string[];
  response_types: string[];
  allowed_scopes: string; // comma separated

  token_endpoint_auth_method: OAuthTokenEndpointAuthMethod;

  // DCR metadata
  registration_access_token?: string;
  registration_client_uri?: string;

  client_id_issued_at?: number;
  client_secret_expires_at?: number;

  fk_user_id?: string;
  created_at: string;
  updated_at: string;
}

// Authorization Code
export interface OAuthAuthorizationCode {
  code: string;
  client_id: string;
  user_id: string;

  // PKCE
  code_challenge: string;
  code_challenge_method: string; // Default: 'S256'

  redirect_uri: string;
  scope: string;
  state?: string;

  resource: string;
  granted_resources?: Record<string, any>;

  expires_at: string;
  is_used: boolean;
  created_at: string;
}

// Access + Refresh Tokens
export interface OAuthToken {
  id: string;
  client_id: string;
  fk_user_id: string;

  access_token: string;
  access_token_expires_at: string;

  refresh_token?: string;
  refresh_token_expires_at?: string;

  // MCP Requirements
  resource: string;
  audience: string;

  granted_resources?: Record<string, any>;
  scope: string;
  // token_type: string; // Default: "Bearer"
  is_revoked: boolean;

  created_at: string;
  last_used_at?: string;
}
