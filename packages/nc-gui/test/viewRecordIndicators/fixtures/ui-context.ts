import { ref } from 'vue'
import { defineStore } from 'pinia'
import { vi } from 'vitest'
import type { ViewType } from 'nocodb-sdk'

export { computed, ref, watch } from 'vue'
export { storeToRefs } from 'pinia'
export { useVModel } from '@vueuse/core'
export { usePersonalViewPermissions } from 'nocodb:usePersonalViewPermissions'

export const user = ref({ id: 'owner-1' })
export const allowedPermissions = ref(new Set(['viewCreateOrEdit', 'fieldAdd']))
export const updateRequest = vi.fn<(id: string, updates: Partial<ViewType>) => Promise<ViewType | null>>()
export const message = { error: vi.fn() }

export const useRoles = () => ({ isUIAllowed: (permission: string) => allowedPermissions.value.has(permission) })
export const useGlobal = () => ({ user })
export const useI18n = () => ({ t: (key: string) => key })
export const extractSdkResponseErrorMsg = async (error: unknown) => (error instanceof Error ? error.message : '')

export const useViewsStore = defineStore('view-record-indicator-settings-tests', () => ({
  viewsByTable: ref(new Map<string, ViewType[]>()),
  updateView: (id: string, updates: Partial<ViewType>) => updateRequest(id, updates),
}))
