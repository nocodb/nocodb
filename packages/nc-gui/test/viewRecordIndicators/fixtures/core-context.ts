import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { vi } from 'vitest'
import { ViewLockType } from 'nocodb-sdk'

export { computed, inject, nextTick, provide, ref, watch } from 'vue'
export { storeToRefs } from 'pinia'
export { onKeyStroke, useDebounceFn, useMagicKeys, useVModel } from '@vueuse/core'
export { ActiveViewInj, IsLockedInj, MetaInj, ProjectInj, SidebarSectionIndentInj, TreeViewInj } from 'nocodb:context'
export { ViewLockType as LockType }

export const NOCO = 'noco'
export const countRequest = vi.fn(async (..._args: unknown[]) => ({ count: 2 } as { count?: number | string }))
export const user = ref({ id: 'test-user', email: 'unit@example.invalid' })
export const useViewsStore = defineStore('indicator-test-views', () => ({ activeView: ref<{ id: string } | null>(null) }))
export const useBases = defineStore('indicator-test-bases', () => ({ basesUser: ref(new Map([['base-1', []]])) }))
export const useNuxtApp = () => ({ $e: vi.fn(), $api: { dbViewRow: { count: countRequest } } })
export const useGlobal = () => ({ isMobileMode: ref(false), user })
export const useI18n = () => ({ t: (key: string) => key })
export const useMetas = () => ({ getMeta: vi.fn(async () => ({ id: 'table-1', base_id: 'base-1' })) })
export const useRtl = () => ({ isRtl: ref(false) })
export const usePersonalViewPermissions = () => ({ canModifyView: computed(() => true) })
export const baseOwnSourceId = () => 'source-1'
export const viewLockIcons = {
  [ViewLockType.Collaborative]: { title: 'title.collaborative', icon: 'span' },
  [ViewLockType.Personal]: { title: 'title.personal', icon: 'span' },
  [ViewLockType.Locked]: { title: 'title.locked', icon: 'span' },
}
