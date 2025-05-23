import { IntegrationWrapper } from '../integration';

export abstract class AuthIntegration extends IntegrationWrapper {
  abstract authenticate(payload: AuthCredentials): Promise<AuthResponse<any>>;
  exchangeToken?(payload: any): Promise<Record<string, any>>;
}

export enum AuthType {
  OAuth = 'oauth',
  ApiKey = 'api_key',
  Basic = 'basic',
  Bearer = 'bearer',
  Custom = 'custom',
}

export interface AuthCredentials<T = any> {
  type: AuthType;
  [key: string]: any;
  custom?: T;
}

export interface AuthResponse<T = any> {
  custom?: T;
}
