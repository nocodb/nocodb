import { useStorage } from '@vueuse/core'
import type { GroupKeysStorage } from '#imports'

/** Scope key that covers every group in a view. */
export const GROUP_SCOPE_ALL = '*'

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

  /**
   * Resolve a group's expanded state. `chain` holds the keys of the group's ancestors and the
   * group itself, outermost first. The group's own explicit state wins, then the nearest scope.
   */
  isGroupExpanded(baseId: string | undefined, viewId: string | undefined, chain: Array<string>): boolean {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey || !chain.length) return false

    const viewData = this.storage.value[storageKey]
    if (!viewData) return false

    this.touch(storageKey)

    const self = chain[chain.length - 1]!
    if (viewData.keys?.includes(self)) return true
    if (viewData.collapsedKeys?.includes(self)) return false

    const scopes = viewData.scopes ?? {}
    for (let i = chain.length - 1; i >= 0; i--) {
      const scoped = scopes[chain[i]!]
      if (scoped !== undefined) return scoped
    }

    return scopes[GROUP_SCOPE_ALL] ?? false
  }

  /** Expand or collapse a single group. */
  setGroupExpanded(baseId: string | undefined, viewId: string | undefined, key: string, expand: boolean): void {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return

    const entry = this.ensureView(storageKey)
    entry.keys = entry.keys.filter((k) => k !== key)
    entry.collapsedKeys = (entry.collapsedKeys ?? []).filter((k) => k !== key)

    if (expand) entry.keys.push(key)
    // Without a scope, a collapsed group is the default and needs no entry
    else if (entry.scopes && Object.keys(entry.scopes).length) entry.collapsedKeys.push(key)

    this.touch(storageKey)
  }

  /**
   * Expand or collapse a group and every group below it, or the whole view with GROUP_SCOPE_ALL.
   * Clears any state recorded below the scope so it applies uniformly.
   */
  setScope(baseId: string | undefined, viewId: string | undefined, key: string, expand: boolean): void {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return

    const entry = this.ensureView(storageKey)

    if (key === GROUP_SCOPE_ALL) {
      entry.keys = []
      entry.collapsedKeys = []
      entry.scopes = expand ? { [GROUP_SCOPE_ALL]: true } : {}
    } else {
      const isAtOrUnder = (k: string) => k === key || k.startsWith(`${key}_`)

      entry.keys = entry.keys.filter((k) => !isAtOrUnder(k))
      entry.collapsedKeys = (entry.collapsedKeys ?? []).filter((k) => !isAtOrUnder(k))
      entry.scopes = Object.fromEntries(Object.entries(entry.scopes ?? {}).filter(([k]) => !isAtOrUnder(k)))
      entry.scopes[key] = expand
    }

    this.touch(storageKey)
  }

  clearView(baseId?: string, viewId?: string): void {
    const storageKey = this.storageKey(baseId, viewId)
    if (!storageKey) return
    delete this.storage.value[storageKey]
  }
}

export const groupKeysManager = new GroupKeysManager()
