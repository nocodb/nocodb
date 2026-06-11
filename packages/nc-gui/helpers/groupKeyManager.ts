import { useStorage } from '@vueuse/core'
import type { GroupKeysStorage } from '#imports'

/**
 * Persists which groups are expanded per view in localStorage.
 *
 * The storage entry is scoped by `baseId` as well as `viewId`: view ids are
 * only unique WITHIN a base — duplicating a base or installing a managed app
 * reuses the source view ids across bases, so keying on viewId alone would
 * leak one base's expanded-group state into its duplicate.
 */
export class GroupKeysManager {
  private storage: Ref<GroupKeysStorage>
  private readonly TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

  constructor() {
    this.storage = useStorage<GroupKeysStorage>('active-group-keys', {})
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

  private touch(storageKey: string): void {
    const entry = this.storage.value[storageKey]
    if (entry) {
      entry.lastAccessed = Date.now()
    }
  }

  private ensureView(storageKey: string): GroupKeysStorage[string] {
    let entry = this.storage.value[storageKey]
    if (!entry) {
      entry = {
        keys: [],
        lastAccessed: Date.now(),
      }
      this.storage.value[storageKey] = entry
    }
    return entry
  }

  hasKey(baseId: string | undefined, viewId: string | undefined, key: string): boolean {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return false

    const viewData = this.storage.value[storageKey]
    if (!viewData || !Array.isArray(viewData.keys)) return false

    this.touch(storageKey)
    return viewData.keys.includes(key)
  }

  getKeys(baseId: string | undefined, viewId: string | undefined): Array<string> {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return []

    const viewData = this.storage.value[storageKey]
    if (!viewData || !Array.isArray(viewData.keys)) return []

    this.touch(storageKey)
    return viewData.keys
  }

  addKey(baseId: string | undefined, viewId: string | undefined, key: string): void {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return

    const keys = this.ensureView(storageKey).keys

    if (!keys.includes(key)) {
      keys.push(key)
    }

    this.touch(storageKey)
  }

  removeKey(baseId: string | undefined, viewId: string | undefined, key: string): void {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return

    const viewData = this.storage.value[storageKey]
    if (!viewData) return

    const index = viewData.keys.indexOf(key)
    if (index !== -1) {
      viewData.keys.splice(index, 1)
    }

    this.touch(storageKey)
  }

  toggleKey(baseId: string | undefined, viewId: string | undefined, key: string, shouldAdd: boolean): void {
    if (shouldAdd) {
      this.addKey(baseId, viewId, key)
    } else {
      this.removeKey(baseId, viewId, key)
    }
  }

  clearView(baseId?: string, viewId?: string): void {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return
    delete this.storage.value[storageKey]
  }
}

export const groupKeysManager = new GroupKeysManager()
