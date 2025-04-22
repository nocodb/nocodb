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
  accessToken?: string;
  expiresIn?: number;
  refreshToken?: string;
  custom?: T;
}
