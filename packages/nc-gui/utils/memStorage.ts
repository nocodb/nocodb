/**
 * Stores all currently created store instances
 */
export class MemStorage<T = any> {
  public currentId = 0
  public items = new Map<string, T>()
  static instance: MemStorage

  public static getInstance(): MemStorage {
    if (!MemStorage.instance) {
      MemStorage.instance = new MemStorage()
    }

    return MemStorage.instance
  }

  public set(id: string, item: T) {
    return this.items.set(id, item)
  }

  public get(id: string) {
    return this.items.get(id)
  }

  public has(id: string) {
    return this.items.has(id)
  }

  public remove(id: string) {
    return this.items.delete(id)
  }

  public getId(prefix?: string) {
    return `${prefix}${this.currentId++}`
  }
}
