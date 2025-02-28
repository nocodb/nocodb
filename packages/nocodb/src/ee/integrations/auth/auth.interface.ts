import type {
  AuthCredentials,
  AuthResponse,
} from '~/integrations/auth/auth.helpers';
import IntegrationWrapper from '~/integrations/integration.wrapper';

export default abstract class AuthIntegration extends IntegrationWrapper {
  public abstract authenticate(payload: AuthCredentials): Promise<AuthResponse>;

  public exchangeToken?(payload: any): Promise<Record<string, any>>;
}
