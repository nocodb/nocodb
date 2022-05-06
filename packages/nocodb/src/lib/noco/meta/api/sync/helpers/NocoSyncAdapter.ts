export abstract class NocoSyncAdapter {
  public abstract init(): Promise<void>;
  public abstract srcSchemaGet(): Promise<any>;
  public abstract srcDataLoad(): Promise<any>;
  public abstract srcDataListen(): Promise<any>;
  public abstract srcDataPoll(): Promise<any>;
  public abstract srcDataWrite(): Promise<any>;
}
