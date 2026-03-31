/**
 * Typed Map with O(1) LRU eviction. Accessing a key via get() promotes
 * it to most-recently-used so frequently accessed entries survive eviction.
 *
 * Standalone instead of extending SimpleLRUCache because that class has
 * an incompatible async get(key, valueGetter) API, uses untyped objects,
 * and O(n) array-filter LRU tracking.
 */
export class LRUMap<V> {
  private map = new Map<string, V>();

  constructor(
    private maxSize: number,
    private onEvict?: (value: V) => void | Promise<void>,
  ) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Re-insert to move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.onEvict?.(this.map.get(firstKey)!);
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
  }

  delete(key: string): boolean {
    if (this.onEvict) {
      const value = this.map.get(key);
      if (value !== undefined) {
        this.onEvict(value);
      }
    }
    return this.map.delete(key);
  }

  /**
   * Remove all entries, calling onEvict for each.
   */
  clear(): void {
    if (this.onEvict) {
      for (const value of this.map.values()) {
        this.onEvict(value);
      }
    }
    this.map.clear();
  }

  /**
   * Like delete(), but awaits onEvict if it returns a Promise.
   * Use for intentional teardown where callers need to wait for cleanup.
   */
  async asyncDelete(key: string): Promise<boolean> {
    if (this.onEvict) {
      const value = this.map.get(key);
      if (value !== undefined) {
        await this.onEvict(value);
      }
    }
    return this.map.delete(key);
  }

  /**
   * Like clear(), but awaits onEvict for every entry if it returns a Promise.
   * Use for intentional teardown (shutdown, cleanup) where callers
   * need all resources fully released before proceeding.
   */
  async asyncClear(): Promise<void> {
    if (this.onEvict) {
      for (const value of this.map.values()) {
        await this.onEvict(value);
      }
    }
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
