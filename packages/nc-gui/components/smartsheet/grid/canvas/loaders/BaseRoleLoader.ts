export class BaseRoleLoader {
  private loadingCache = new Map<string, string>() // Cache for ongoing loading promises

  constructor(
    private getBaseRole: (baseId: string) => Promise<any | null>, // Replace `any` with the appropriate type for base roles
    private onSettled?: () => void,
  ) {}

  async loadBaseRole(baseId: string): Promise<any | undefined> {
    if (this.loadingCache.has(baseId)) return

    this.loadingCache.set(baseId, baseId)

    try {
      await this.getBaseRole(baseId)
      this.onSettled?.()
    } finally {
      this.loadingCache.delete(baseId)
    }
  }

  /**
   * Checks if a base role is currently being loaded.
   */
  isLoading(id: string): boolean {
    return this.loadingCache.has(id)
  }

  clearCaches(): void {
    this.loadingCache.clear()
  }
}
