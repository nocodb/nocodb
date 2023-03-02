export abstract class NocoSyncSourceAdapter {
  public abstract init(): Promise<void>;
  public abstract srcSchemaGet(): Promise<any>;
  public abstract srcDataLoad(): Promise<any>;
  public abstract srcDataListen(): Promise<any>;
  public abstract srcDataPoll(): Promise<any>;
}
