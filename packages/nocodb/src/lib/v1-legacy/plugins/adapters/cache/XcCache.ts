import LRU from 'lru-cache';

export default class XcCache {
  private static disabled: boolean = process.env.NC_NO_CACHE === '1';
  public static init(config: any, overwrite = false) {
    if (this.disabled) return;

    if (overwrite && this.instance) {
      this.instance.reset();
      this.instance = null;
    }

    if (!this.instance) {
      const options = {
        max: 500,
        maxAge: 1000 * 60 * 60,
      };
      if (config) {
        const input = JSON.parse(config.input);
        Object.assign(options, input);
      }

      this.instance = new LRU(options);
    }
  }

  public static get(key): any {
    return this.instance?.get(key);
  }

  public static set(key, val, maxAge = 1000 * 60 * 60): boolean {
    return this.instance?.set(key, val, maxAge);
  }

  public static del(key): void {
    this.instance?.del(key);
  }

  private static instance: LRU<any, any>;
}
