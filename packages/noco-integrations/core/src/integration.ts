export class IntegrationWrapper<T = any> {
  protected _config: Readonly<T>;
  protected logger: (message: string) => void;

  constructor(config: T, logger?: (message: string) => void) {
    this._config = config;
    this.logger = logger || console.log;
  }

  get config(): Readonly<T> {
    return this._config;
  }

  log(message: string) {
    if (this.logger) {
      this.logger(message);
    }
  }
}
