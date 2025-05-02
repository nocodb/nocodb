import axios, { type AxiosInstance } from 'axios';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export default class RestAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials,
  ): Promise<AuthResponse<AxiosInstance>> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          custom: axios.create({
            baseURL: payload.baseUrl,
            headers: {
              'Content-Type': 'application/json',
              [payload.headerName]: payload.apiKey,
            },
          }),
        };
      case AuthType.Basic:
        return {
          custom: axios.create({
            baseURL: payload.baseUrl,
            headers: {
              'Content-Type': 'application/json',
            },
            auth: {
              username: payload.username,
              password: payload.password,
            },
          }),
        };
      case AuthType.Bearer:
        return {
          custom: axios.create({
            baseURL: payload.baseUrl,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${payload.bearerToken}`,
            },
          }),
        };
      default:
        throw new Error('Not implemented');
    }
  }
}
