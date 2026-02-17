import { useStorage } from '@vueuse/core'

interface ExtensionData {
  baseId: string
  data: any
}

interface ExtensionUserPrefs {
  [userId: string]: {
    [extensionId: string]: ExtensionData
    lastAccessed: number
  }
}

export class ExtensionUserPrefsManager {
  private storage: Ref<ExtensionUserPrefs>
  private readonly TTL = 90 * 24 * 60 * 60 * 1000 // 90 days

  constructor() {
    this.storage = useStorage<ExtensionUserPrefs>('nc-extension-user-prefs', {})
    this.cleanExpired()
  }

  private cleanExpired(): void {
    const now = Date.now()
    const data = this.storage.value

    Object.keys(data).forEach((userId) => {
      if (now - data[userId].lastAccessed > this.TTL) {
        delete data[userId]
      }
    })
  }

  private touch(userId: string): void {
    if (this.storage.value[userId]) {
      this.storage.value[userId].lastAccessed = Date.now()
    }
  }

  private ensureUser(userId: string): void {
    if (!this.storage.value[userId]) {
      this.storage.value[userId] = {
        lastAccessed: Date.now(),
      }
    }
  }

  get(userId: string, extensionId: string): any {
    if (!userId || !extensionId) return null

    const userData = this.storage.value[userId]
    if (!userData) return null

    this.touch(userId)
    const extensionData = userData[extensionId]
    return extensionData?.data || null
  }

  set(userId: string, extensionId: string, value: any, baseId: string): void {
    if (!userId || !extensionId || !baseId) return

    this.ensureUser(userId)
    this.storage.value[userId][extensionId] = {
      baseId,
      data: value,
    }
    this.touch(userId)
  }

  delete(userId: string, extensionId: string): void {
    if (!userId || !extensionId) return

    const userData = this.storage.value[userId]
    if (!userData) return

    delete userData[extensionId]
    this.touch(userId)
  }

  /**
   * Delete all extension preferences for a specific extension ID across all users
   * Used when an extension is deleted
   */
  deleteExtension(extensionId: string): void {
    if (!extensionId) return

    const data = this.storage.value
    Object.keys(data).forEach((userId) => {
      if (data[userId][extensionId]) {
        delete data[userId][extensionId]
      }
    })
  }

  /**
   * Delete all extension preferences for a specific base across all users
   * Used when a base is deleted
   */
  deleteBase(baseId: string): void {
    if (!baseId) return

    const data = this.storage.value
    Object.keys(data).forEach((userId) => {
      const userData = data[userId]
      Object.keys(userData).forEach((extensionId) => {
        if (extensionId === 'lastAccessed') return
        const extensionData = userData[extensionId] as ExtensionData
        if (extensionData?.baseId === baseId) {
          delete userData[extensionId]
        }
      })
    })
  }

  /**
   * Verify and clean up extension preferences based on loaded extensions
   * Removes preferences for extensions that no longer exist
   */
  verifyAndCleanup(userId: string, validExtensionIds: string[]): void {
    if (!userId) return

    const userData = this.storage.value[userId]
    if (!userData) return

    const validSet = new Set(validExtensionIds)
    Object.keys(userData).forEach((extensionId) => {
      if (extensionId === 'lastAccessed') return
      if (!validSet.has(extensionId)) {
        delete userData[extensionId]
      }
    })

    this.touch(userId)
  }

  /**
   * Get all extension IDs stored for a user
   */
  getExtensionIds(userId: string): string[] {
    if (!userId) return []

    const userData = this.storage.value[userId]
    if (!userData) return []

    return Object.keys(userData).filter((key) => key !== 'lastAccessed')
  }
}

export const extensionUserPrefsManager = new ExtensionUserPrefsManager()
