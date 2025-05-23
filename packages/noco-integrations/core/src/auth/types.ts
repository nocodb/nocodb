import { IntegrationWrapper } from '../integration';

export abstract class AuthIntegration<T = any> extends IntegrationWrapper<T> {
  public client: any = null;

  abstract authenticate(): Promise<AuthResponse<any>>;
  abstract testConnection(): Promise<TestConnectionResponse>;
  exchangeToken?(oauthPayload: any): Promise<Record<string, any>>;
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
