export class AliasMapper {
  private aliasMap = new Map<string, unknown>()

  generateAlias(key: unknown): string {
    const alias = Math.random().toString(36).substring(2, 15)
    this.aliasMap.set(alias, key)
    return alias
  }

  getAlias(alias: string): unknown {
    return this.aliasMap.get(alias)
  }

  clear() {
    this.aliasMap.clear()
  }

  async process<T extends Record<string, unknown>>(
    data: Record<string, T>,
    processor: (key: unknown, value: T) => void | Promise<void>,
  ): Promise<void> {
    for (const [alias, value] of Object.entries(data)) {
      const originalKey = this.getAlias(alias)
      if (originalKey !== undefined) {
        await processor(originalKey, value)
      }
    }
  }
}
