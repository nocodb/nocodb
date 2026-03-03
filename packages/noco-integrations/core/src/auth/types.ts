
export interface TokenData {
  oauth_token: string;
  refresh_token?: string;
  expires_at?: string;
}

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
