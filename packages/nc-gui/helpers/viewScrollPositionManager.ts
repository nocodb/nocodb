import { useStorage } from '@vueuse/core'
import type { ViewScrollPositionStorage } from '#imports'

interface ViewScrollPosition {
  scrollTop: number
  scrollLeft: number
}

/**
 * Persists the last grid scroll position (scrollTop/scrollLeft) per view in
 * localStorage so a user returns to where they left off when navigating back
 * to a view. Mirrors the `groupKeysManager` pattern (TTL-pruned).
 *
 * The storage key is scoped by `baseId` as well as `viewId`: view ids are only
 * unique WITHIN a base — duplicating a base or installing a managed app reuses
 * the source view ids across bases, so keying on viewId alone would leak one
 * base's scroll position into its duplicate.
 */
export class ViewScrollPositionManager {
  private storage: Ref<ViewScrollPositionStorage>
  private readonly TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

  constructor() {
    this.storage = useStorage<ViewScrollPositionStorage>('nc-view-scroll-position', {})
    this.cleanExpired()
  }

  private storageKey(baseId?: string, viewId?: string): string | null {
    if (!baseId || !viewId) return null
    return `${baseId}::${viewId}`
  }

  private cleanExpired(): void {
    const now = Date.now()
    const data = this.storage.value

    Object.keys(data).forEach((key) => {
      const entry = data[key]
      if (entry && now - entry.lastAccessed > this.TTL) {
        delete data[key]
      }
    })
  }

  get(baseId?: string, viewId?: string): ViewScrollPosition | null {
    const key = this.storageKey(baseId, viewId)
    if (!key) return null

    const viewData = this.storage.value[key]
    if (!viewData) return null

    viewData.lastAccessed = Date.now()
    return { scrollTop: viewData.scrollTop, scrollLeft: viewData.scrollLeft }
  }

  set(baseId: string | undefined, viewId: string | undefined, position: ViewScrollPosition): void {
    const key = this.storageKey(baseId, viewId)
    if (!key) return

    this.storage.value[key] = {
      scrollTop: Math.max(0, position.scrollTop || 0),
      scrollLeft: Math.max(0, position.scrollLeft || 0),
      lastAccessed: Date.now(),
    }
  }

  clearView(baseId?: string, viewId?: string): void {
    const key = this.storageKey(baseId, viewId)
    if (!key) return
    delete this.storage.value[key]
  }
}

export const viewScrollPositionManager = new ViewScrollPositionManager()
