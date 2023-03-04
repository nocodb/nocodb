export abstract class NocoSyncSourceAdapter {
  public abstract init(): Promise<void>;
  public abstract destProjectWrite(): Promise<any>;
  public abstract destSchemaWrite(): Promise<any>;
  public abstract destDataWrite(): Promise<any>;
}
