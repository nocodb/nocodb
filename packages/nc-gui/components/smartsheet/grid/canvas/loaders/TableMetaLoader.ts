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

  async getTableMeta(tableIdOrTitle: string): Promise<TableType | undefined> {
    if (this.loadingCache.get(tableIdOrTitle)) return

    this.loadingCache.set(tableIdOrTitle, tableIdOrTitle)
    try {
      await this.getMeta(this.baseId!, tableIdOrTitle, undefined, undefined, true)
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
