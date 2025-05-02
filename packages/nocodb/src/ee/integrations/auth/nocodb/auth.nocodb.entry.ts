import { Api } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export default class NocodbAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials<{ baseURL?: string }>,
  ): Promise<AuthResponse<Api<any>>> {
    switch (payload.type) {
      case AuthType.ApiKey:
        return {
          custom: new Api({
            baseURL:
              payload.custom.baseURL ||
              (process.env.TEST === 'true'
                ? 'http://localhost:8080'
                : 'https://app.nocodb.com'),
            headers: {
              'xc-token': payload.token,
            },
          }),
        };
      default:
        NcError.notImplemented();
    }
  }
}
