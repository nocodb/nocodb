import { useStorage } from '@vueuse/core'
import type { GroupKeysStorage } from '#imports'

export class GroupKeysManager {
  private storage: Ref<GroupKeysStorage>
  private readonly TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

  constructor() {
    this.storage = useStorage<GroupKeysStorage>('active-group-keys', {})
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

  private touch(viewId: string): void {
    if (this.storage.value[viewId]) {
      this.storage.value[viewId].lastAccessed = Date.now()
    }
  }

  private ensureView(viewId: string): void {
    if (!this.storage.value[viewId]) {
      this.storage.value[viewId] = {
        keys: [],
        lastAccessed: Date.now(),
      }
    }
  }

  hasKey(viewId: string, key: string): boolean {
    if (!viewId) return false

    const viewData = this.storage.value[viewId]
    if (!viewData || !Array.isArray(viewData.keys)) return false

    this.touch(viewId)
    return viewData.keys.includes(key)
  }

  getKeys(viewId: string): Array<string> {
    if (!viewId) return []

    const viewData = this.storage.value[viewId]
    if (!viewData || !Array.isArray(viewData.keys)) return []

    this.touch(viewId)
    return viewData.keys
  }

  addKey(viewId: string, key: string): void {
    if (!viewId) return

    this.ensureView(viewId)
    const keys = this.storage.value[viewId].keys

    if (!keys.includes(key)) {
      keys.push(key)
    }

    this.touch(viewId)
  }

  removeKey(viewId: string, key: string): void {
    if (!viewId) return

    const viewData = this.storage.value[viewId]
    if (!viewData) return

    const index = viewData.keys.indexOf(key)
    if (index !== -1) {
      viewData.keys.splice(index, 1)
    }

    this.touch(viewId)
  }

  toggleKey(viewId: string, key: string, shouldAdd: boolean): void {
    if (shouldAdd) {
      this.addKey(viewId, key)
    } else {
      this.removeKey(viewId, key)
    }
  }

  clearView(viewId: string): void {
    if (!viewId) return
    delete this.storage.value[viewId]
  }
}

export const groupKeysManager = new GroupKeysManager()
