export class IntegrationWrapper {
  protected config: any;

  constructor(config: any) {
    this.config = config;
  }

  public getConfig() {
    return this.config;
  }
}
