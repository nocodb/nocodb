import type { TableType } from 'nocodb-sdk'

export class TableMetaLoader {
  private loadingCache = new Map<string, string>() // Cache for ongoing loading promises

  constructor(
    private getMeta: (
      tableIdOrTitle: string,
      force?: boolean,
      skipIfCacheMiss?: boolean,
      baseId?: string,
    ) => Promise<TableType | null>,
    private onSettled?: () => void,
  ) {}

  async getTableMeta(tableIdOrTitle: string): Promise<TableType | undefined> {
    if (this.loadingCache.get(tableIdOrTitle)) return

    this.loadingCache.set(tableIdOrTitle, tableIdOrTitle)
    try {
      await this.getMeta(tableIdOrTitle)
      this.onSettled?.()
    } finally {
      this.loadingCache.delete(tableIdOrTitle)
    }
  }

  /**
   * Checks if a table's metadata is currently being loaded.
   */
  isLoading(id: string): boolean {
    return this.loadingCache.has(id)
  }

  clearCaches(): void {
    this.loadingCache.clear()
  }
}
