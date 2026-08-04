import { useStorage } from '@vueuse/core'

export interface FormDraftField {
  uidt: string
  value: any
}

export interface FormDraft {
  savedAt: number
  fields: Record<string /* columnId */, FormDraftField>
}

export type FormDraftMap = Record<string /* sharedViewUuid */, FormDraft>

const STORAGE_KEY = 'nc-shared-form-drafts'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

export class FormDraftStorageManager {
  private storage: Ref<FormDraftMap>
  private readonly ttl = TTL_MS

  constructor() {
    this.storage = useStorage<FormDraftMap>(STORAGE_KEY, {})
    this.cleanExpired()
  }

  get(sharedViewUuid: string): FormDraft | undefined {
    if (!sharedViewUuid) return undefined
    const draft = this.storage.value[sharedViewUuid]
    if (!draft) return undefined
    if (Date.now() - draft.savedAt > this.ttl) {
      delete this.storage.value[sharedViewUuid]
      return undefined
    }
    return draft
  }

  set(sharedViewUuid: string, draft: FormDraft): void {
    if (!sharedViewUuid) return
    try {
      this.storage.value[sharedViewUuid] = draft
    } catch (e: any) {
      if (this.isQuotaError(e)) {
        this.evictOldest(sharedViewUuid)
        try {
          this.storage.value[sharedViewUuid] = draft
        } catch {
          // give up silently — draft persistence must never break the form
        }
      }
    }
  }

  clear(sharedViewUuid: string): void {
    if (!sharedViewUuid) return
    if (this.storage.value[sharedViewUuid]) {
      delete this.storage.value[sharedViewUuid]
    }
  }

  private cleanExpired(): void {
    const now = Date.now()
    const data = this.storage.value
    Object.keys(data).forEach((uuid) => {
      if (!data[uuid] || now - data[uuid].savedAt > this.ttl) {
        delete data[uuid]
      }
    })
  }

  private evictOldest(exceptUuid: string): void {
    const entries = Object.entries(this.storage.value)
      .filter(([uuid]) => uuid !== exceptUuid)
      .sort((a, b) => (a[1]?.savedAt ?? 0) - (b[1]?.savedAt ?? 0))
    const oldest = entries[0]
    if (oldest) {
      delete this.storage.value[oldest[0]]
    }
  }

  private isQuotaError(e: any): boolean {
    return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)
  }
}

export const formDraftStorageManager = new FormDraftStorageManager()
