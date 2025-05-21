export default class SimpleLRUCache {
  private cache: { [key: string]: any } = {};
  private keys: string[] = [];

  constructor(private readonly limit = 1000) {}

  async get<T = any>(key: string, valueGetter: () => Promise<T>) {
    if (this.cache[key]) {
      this.keys = this.keys.filter((k) => k !== key);
      this.keys.push(key);
      return this.cache[key];
    } else {
      const value = await valueGetter();
      this.set(key, value);
      return value;
    }
  }

  set(key: string, value: any) {
    if (this.keys.length >= this.limit) {
      const keyToRemove = this.keys.shift();
      delete this.cache[keyToRemove];
    }

    this.cache[key] = value;
    this.keys.push(key);
  }

  clear() {
    this.cache = {};
    this.keys = [];
  }
}
