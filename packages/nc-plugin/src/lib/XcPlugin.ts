import XcPluginHooks from './XcPluginHooks';

abstract class XcPlugin extends XcPluginHooks {
  protected readonly app: any;
  public readonly config: any;

  constructor(app: any, config: any) {
    super();
    this.app = app;
    this.config = config;
  }

  abstract init(config: any): Promise<any>;

  // public getHooks(): XcPluginHooks{
  //   return null;
  // }
}

export default XcPlugin;
