import { useStorage } from '@vueuse/core'

interface ExtensionUserPrefs {
  [userId: string]: {
    [extensionId: string]: any
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
    return userData[extensionId] || null
  }

  set(userId: string, extensionId: string, value: any): void {
    if (!userId || !extensionId) return

    this.ensureUser(userId)
    this.storage.value[userId][extensionId] = value
    this.touch(userId)
  }

  delete(userId: string, extensionId: string): void {
    if (!userId || !extensionId) return

    const userData = this.storage.value[userId]
    if (!userData) return

    delete userData[extensionId]
    this.touch(userId)
  }
}

export const extensionUserPrefsManager = new ExtensionUserPrefsManager()
