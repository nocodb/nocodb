import type { TableType } from 'nocodb-sdk'

export class TableMetaLoader {
  private loadingCache = new Map<string, string>() // Cache for ongoing loading promises

  constructor(
    private getMeta: (
      baseId: string,
      tableIdOrTitle: string,
      force?: boolean,
      skipIfCacheMiss?: boolean,
      disableError?: boolean,
      navigateOnNotFound?: boolean,
    ) => Promise<TableType | null>,
    private onSettled?: () => void,
    private baseId?: string,
  ) {}

  async getTableMeta(tableIdOrTitle: string, baseIdOverride?: string): Promise<TableType | undefined> {
    const effectiveBaseId = baseIdOverride || this.baseId

    if (!effectiveBaseId) {
      console.error('[TableMetaLoader] baseId is required but was not provided')
      return
    }

    // Use a composite cache key to handle cross-base scenarios
    const cacheKey = `${effectiveBaseId}:${tableIdOrTitle}`
    if (this.loadingCache.get(cacheKey)) return

    this.loadingCache.set(cacheKey, cacheKey)
    try {
      await this.getMeta(effectiveBaseId, tableIdOrTitle, undefined, undefined, true)
      this.onSettled?.()
    } finally {
      this.loadingCache.delete(cacheKey)
    }
  }

  /**
   * Checks if a table's metadata is currently being loaded.
   * @param id - The table ID to check
   * @param baseIdOverride - Optional base ID for cross-base checks
   */
  isLoading(id: string, baseIdOverride?: string): boolean {
    const effectiveBaseId = baseIdOverride || this.baseId
    if (!effectiveBaseId) return false

    const cacheKey = `${effectiveBaseId}:${id}`
    return this.loadingCache.has(cacheKey)
  }

  clearCaches(): void {
    this.loadingCache.clear()
  }
}
