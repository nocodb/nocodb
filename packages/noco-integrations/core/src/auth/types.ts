import { IntegrationWrapper } from '../integration';

export abstract class AuthIntegration<T = any> extends IntegrationWrapper<T> {
  abstract authenticate(): Promise<AuthResponse<any>>;
  abstract testConnection(): Promise<TestConnectionResponse>;
  exchangeToken?(oauthPayload: any): Promise<Record<string, any>>;
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

export interface AuthResponse<T = any> {
  custom?: T;
}
