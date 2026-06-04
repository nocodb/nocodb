import { useStorage } from '@vueuse/core'
import type { ViewScrollPositionStorage } from '#imports'

interface ViewScrollPosition {
  scrollTop: number
  scrollLeft: number
}

/**
 * Persists the last grid scroll position (scrollTop/scrollLeft) per view in
 * localStorage so a user returns to where they left off when navigating back
 * to a view. Mirrors the `groupKeysManager` pattern (viewId-keyed, TTL-pruned).
 */
export class ViewScrollPositionManager {
  private storage: Ref<ViewScrollPositionStorage>
  private readonly TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

  constructor() {
    this.storage = useStorage<ViewScrollPositionStorage>('nc-view-scroll-position', {})
    this.cleanExpired()
  }

  private cleanExpired(): void {
    const now = Date.now()
    const data = this.storage.value

    Object.keys(data).forEach((viewId) => {
      if (now - data[viewId].lastAccessed > this.TTL) {
        delete data[viewId]
      }
    })
  }

  get(viewId?: string): ViewScrollPosition | null {
    if (!viewId) return null

    const viewData = this.storage.value[viewId]
    if (!viewData) return null

    viewData.lastAccessed = Date.now()
    return { scrollTop: viewData.scrollTop, scrollLeft: viewData.scrollLeft }
  }

  set(viewId: string | undefined, position: ViewScrollPosition): void {
    if (!viewId) return

    this.storage.value[viewId] = {
      scrollTop: Math.max(0, position.scrollTop || 0),
      scrollLeft: Math.max(0, position.scrollLeft || 0),
      lastAccessed: Date.now(),
    }
  }

  clearView(viewId?: string): void {
    if (!viewId) return
    delete this.storage.value[viewId]
  }
}

export const viewScrollPositionManager = new ViewScrollPositionManager()
