import type { ApiTokenPermissions, ApiTokenScopeEntry } from 'nocodb-sdk';

export interface ApiTokensV3CreateRequest {
  title: string;
  scopes?: ApiTokenScopeEntry[];
  expiry?: string;
}

export interface ApiTokensV3UpdateRequest {
  title?: string;
  scopes?: ApiTokenScopeEntry[];
  expiry?: string;
  enabled?: boolean;
}

export interface ApiTokensV3Scope {
  id: string;
  resource_type: string;
  resource_id: string;
  permissions?: ApiTokenPermissions;
}

export interface ApiTokensV3 {
  id: string;
  title: string;
  scopes?: ApiTokensV3Scope[];
  token_prefix?: string;
  expiry?: string;
  enabled?: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiTokensV3ListResponse {
  list: ApiTokensV3[];
}

export interface ApiTokensV3WithToken extends ApiTokensV3 {
  token: string;
}
