import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type { DataObjectStream } from '~/integrations/sync/sync.helpers';
import type { SyncColumnDefinition } from '~/integrations/sync/sync.schemas';
import IntegrationWrapper from '~/integrations/integration.wrapper';

export default abstract class SyncIntegration extends IntegrationWrapper {
  public static destinationSchema: readonly SyncColumnDefinition[];

  public abstract fetchData(
    auth: AuthResponse,
    payload: any,
    options: {
      last_record?: any;
    },
  ): Promise<DataObjectStream>;

  public abstract getIncrementalKey(): string;
}
