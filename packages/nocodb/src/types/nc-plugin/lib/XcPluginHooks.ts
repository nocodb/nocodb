abstract class XcPluginHooks {
  public async appStart(): Promise<any> {}

  public async projectStart(): Promise<any> {}

  public async projectStop(): Promise<any> {}

  public async projectDelete(): Promise<any> {}

  public async syncMigrations(): Promise<any> {}
}
export default XcPluginHooks;
