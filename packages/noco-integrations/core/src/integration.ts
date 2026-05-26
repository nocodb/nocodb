export class IntegrationWrapper<T = any> {
  protected _config: Readonly<T & { _vars?: any }>;
  protected logger: (message: string) => void;
  protected saveConfig: (config: any) => Promise<void>;

  constructor(
    config: T & { _vars?: any },
    option: {
      saveConfig?(config: any): Promise<void>;
      logger?: (message: string) => void;
    },
  ) {
    this._config = config;
    this.logger = option.logger || console.log;
    this.saveConfig = option.saveConfig ?? (async(_config) => {});
  }

  get config(): Readonly<T> {
    // Strip framework-injected non-persistable slots:
    //   - `_vars` : runtime variable bag, persisted separately via saveVars
    //   - `_nocodb`: live NocoDB service handles + request context injected
    //     into sync/workflow wrappers at runtime; not safe to JSON-serialise
    //     into the integration record.
    const { _vars, _nocodb, ...rest } = this._config as any;
    return { ...rest } as Readonly<T>;
  }
  getVars(): any | undefined {
    return { ...this._config._vars };
  }
  async saveVars(variable: any) {
    const newConfig = {
      ...this.config,
      _vars: variable,
    }
    await this.saveConfig(newConfig);

    this._config = newConfig;
  }

  log(message: string) {
    if (this.logger) {
      this.logger(message);
    }
  }
}
