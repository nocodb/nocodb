export class IntegrationWrapper<T = any> {
  protected _config: Readonly<T>;

  constructor(config: T) {
    this._config = config;
  }

  get config(): Readonly<T> {
    return this._config;
  }
}
