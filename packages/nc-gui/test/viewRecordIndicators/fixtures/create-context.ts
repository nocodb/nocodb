import { computed, nextTick, onBeforeMount, onMounted, reactive, ref, toRefs, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { vi } from 'vitest'
import { useVModel } from '@vueuse/core'
import { ViewLockType } from 'nocodb-sdk'

export { computed, nextTick, onBeforeMount, onMounted, reactive, ref, storeToRefs, toRefs, useVModel, watch }

interface CreateTestHooks {
  createRequest: ReturnType<typeof vi.fn>
  updateRequest: ReturnType<typeof vi.fn>
  message: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; toast: ReturnType<typeof vi.fn> }
}

const CREATE_TEST_HOOKS_KEY = '__nocodb9135CreateTestHooks'
const hookHost = globalThis as typeof globalThis & { [CREATE_TEST_HOOKS_KEY]?: CreateTestHooks }
const testHooks =
  hookHost[CREATE_TEST_HOOKS_KEY] ??
  (hookHost[CREATE_TEST_HOOKS_KEY] = {
    createRequest: vi.fn(),
    updateRequest: vi.fn(),
    message: { error: vi.fn(), info: vi.fn(), toast: vi.fn() },
  })

export const { createRequest, updateRequest, message } = testHooks
export const allowedPermissions = ref(new Set(['viewCreateOrEdit', 'fieldAdd']))
export const activeBaseId = ref('base-1')

export const useNuxtApp = () => ({ $e: vi.fn() })
export const useGlobal = () => ({ isMobileMode: ref(false) })
export const useI18n = () => ({ t: (key: string) => key })
export const useMetas = () => ({
  getMeta: vi.fn(async () => ({ id: 'table-1', base_id: 'base-1', columns: [] })),
  getMetaByKey: vi.fn(() => undefined),
})
export const useWorkspace = () => ({ navigateToIntegrations: vi.fn() })
export const useBase = defineStore('indicator-create-base', () => ({ baseId: activeBaseId }))
export const useBases = defineStore('indicator-create-bases', () => ({ bases: ref(new Map()) }))
export const useEeConfig = () => ({
  blockCalendarRange: ref(false),
  getPlanTitle: vi.fn(() => 'plan'),
  showEEFeatures: ref(false),
  getFeature: vi.fn(() => false),
})
export const useRoles = () => ({ isUIAllowed: (permission: string) => allowedPermissions.value.has(permission) })
export const useViewsStore = defineStore('indicator-create-views', () => ({
  viewsByTable: ref(new Map()),
  createView: (...args: unknown[]) => createRequest(...args),
  updateView: (...args: unknown[]) => updateRequest(...args),
}))
export const useCommandPalette = () => ({ refreshCommandPalette: vi.fn(async () => undefined) })
export const useNocoAi = () => ({
  isAiFeaturesEnabled: ref(false),
  aiIntegrationAvailable: ref(false),
  aiLoading: ref(false),
  aiError: ref(''),
  predictViews: vi.fn(async () => []),
  createViews: vi.fn(async () => []),
})

export const AiWizardTabsType = { AUTO_SUGGESTIONS: 'auto-suggestions' } as const
export const viewLockIcons = {
  [ViewLockType.Collaborative]: { title: 'title.collaborative', subtitle: 'subtitle.collaborative', icon: 'span' },
  [ViewLockType.Personal]: { title: 'title.personal', subtitle: 'subtitle.personal', icon: 'span' },
  [ViewLockType.Locked]: { title: 'title.locked', subtitle: 'subtitle.locked', icon: 'span' },
}

export const extractSdkResponseErrorMsg = async (error: unknown) => (error instanceof Error ? error.message : '')
export const isMac = () => false
export const isAttachment = () => false
export const generateUniqueTitle = (title: string) => title
export const getPluralName = (key: string) => key
export const ncIsArray = Array.isArray
export const ncIsArrayIncludes = (items: Array<Record<string, unknown>>, value: unknown, key: string) =>
  items.some((item) => item[key] === value)
