
export interface TokenData {
  oauth_token: string;
  refresh_token?: string;
  expires_at?: string;
}

/**
 * A stored auth config as `maskConfig()` receives it: the package's own
 * config shape, plus token material the core OAuth machinery persists after
 * an exchange/refresh, plus the transient (pre-exchange) `oauth` payload —
 * which implementations must DROP, not mask.
 */
export type MaskableAuthConfig<TConfig> = TConfig &
  Partial<TokenData> & { oauth?: Record<string, unknown> };

export interface TestConnectionResponse {
  success: boolean;
  message?: string;
}

export enum AuthType {
  OAuth = 'oauth',
  ApiKey = 'api_key',
  Basic = 'basic',
  Bearer = 'bearer',
  Custom = 'custom',
}

export interface OAuthConfig {
  type: AuthType.OAuth;
  oauth_token: string;
  refresh_token: string;
  expires_at?: string;
  client_id: string;
  client_secret: string;
}

export type AuthResponse<TClient = any> = TClient;
