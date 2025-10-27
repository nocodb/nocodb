import { useStorage } from '@vueuse/core'
import type { GroupKeysStorage } from '#imports'

export interface WorkspaceSettings {
  data: {
    showOtherUserPersonalViews: boolean
    // any other ws level keys we can store here
    [key: string]: any
  }
  lastAccessed: number // TTL and tracking
}

export interface UserLocalStorageInfo {
  [userId: string]: {
    [workspaceId: string]: WorkspaceSettings
  }
}

export class UserLocalStorageInfoManager {
  private storage: Ref<UserLocalStorageInfo>
  private readonly TTL = 180 * 24 * 60 * 60 * 1000 // 180 days
  private readonly defaultData: WorkspaceSettings['data'] = {
    showOtherUserPersonalViews: true,
  }

  constructor() {
    this.storage = useStorage<UserLocalStorageInfo>('nc-user-local-storage-info', {})
    this.cleanExpired()
  }

  /** Cleanup expired workspace settings */
  private cleanExpired(): void {
    const now = Date.now()
    const data = this.storage.value

    Object.keys(data).forEach((userId) => {
      const workspaces = data[userId]
      if (!workspaces) return

      Object.keys(workspaces).forEach((wsId) => {
        if (now - workspaces[wsId]!.lastAccessed > this.TTL) {
          delete workspaces[wsId]
        }
      })

      // remove user entirely if no workspaces left
      if (Object.keys(workspaces).length === 0) {
        delete data[userId]
      }
    })
  }

  /** Cleanup local storage workspaces that no longer exist */
  cleanMissingWorkspaces(userId: string, workspaceIds: string[]): void {
    const userWorkspaces = this.storage.value[userId]
    if (!userWorkspaces) return

    Object.keys(userWorkspaces).forEach((wsId) => {
      if (!workspaceIds.includes(wsId)) {
        delete userWorkspaces[wsId]
      } else {
        this.touch(userId, wsId)
      }
    })

    // Remove user if no workspace left
    if (Object.keys(userWorkspaces).length === 0) {
      delete this.storage.value[userId]
    }
  }

  /** Ensure workspace exists for user */
  private ensureWorkspace(userId: string, workspaceId: string, defaultData: WorkspaceSettings['data'] = this.defaultData): void {
    if (!userId || !workspaceId) return

    if (!this.storage.value[userId]) this.storage.value[userId] = {}

    if (!this.storage.value[userId][workspaceId]) {
      this.storage.value[userId][workspaceId] = {
        data: { ...defaultData },
        lastAccessed: Date.now(),
      }
    }
  }

  /** Update lastAccessed timestamp */
  private touch(userId: string, workspaceId: string): void {
    if (!userId || !workspaceId) return

    if (this.storage.value[userId]?.[workspaceId]) {
      this.storage.value[userId][workspaceId].lastAccessed = Date.now()
    }
  }

  /** Get a workspace-level key */
  get(userId: string, workspaceId: string, key: keyof WorkspaceSettings['data'], defaultValue: any = null): any {
    if (!userId || !workspaceId) return defaultValue

    this.touch(userId, workspaceId)
    return this.storage.value[userId]?.[workspaceId]?.data[key] ?? defaultValue
  }

  /** Set a workspace-level key */
  set(userId: string, workspaceId: string, key: string, value: any): void {
    if (!userId || !workspaceId || !key) return

    this.ensureWorkspace(userId, workspaceId)
    this.storage.value[userId]![workspaceId]!.data[key] = value
    this.touch(userId, workspaceId)
  }

  /** Clear workspace for user */
  clearWorkspace(userId: string, workspaceId: string): void {
    if (!userId || !workspaceId) return

    if (this.storage.value[userId]?.[workspaceId]) {
      delete this.storage.value[userId][workspaceId]
    }
  }

  /** Clear all data for a user */
  clearUser(userId: string): void {
    if (!userId) return

    if (this.storage.value[userId]) {
      delete this.storage.value[userId]
    }
  }
}

export const userLocalStorageInfoManager = new UserLocalStorageInfoManager()
