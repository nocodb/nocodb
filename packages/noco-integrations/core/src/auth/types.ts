import { IntegrationWrapper } from '../integration';

export abstract class AuthIntegration<T = any> extends IntegrationWrapper<T> {
  public client: any = null;
  protected tokenRefreshCallback?: (tokens: {
    oauth_token: string;
    refresh_token?: string;
    expires_at?: string
  }) => Promise<void>;

  public setTokenRefreshCallback(
    callback: (tokens: {
      oauth_token: string;
      refresh_token?: string;
      expires_at?: string
    }) => Promise<void>,
  ) {
    this.tokenRefreshCallback = callback;
  }

  abstract authenticate(): Promise<AuthResponse<any>>;
  abstract testConnection(): Promise<TestConnectionResponse>;
  exchangeToken?(oauthPayload: any): Promise<Record<string, any>>;
  refreshToken?(payload: { refresh_token: string }): Promise<Record<string, any>>;
  destroy?(): Promise<void>;
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

export type AuthResponse<T = any> = T;
