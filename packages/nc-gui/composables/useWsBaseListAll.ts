import { NO_SCOPE } from 'nocodb-sdk'

export interface BaseListAllData {
  workspaces: {
    id: string
    title: string
    meta: Record<string, any>
    plan_title: string | null
    bases: {
      id: string
      title: string
      meta: Record<string, any>
      role: string
      order: number
      managed_app_master?: boolean
      managed_app_id?: string | null
    }[]
  }[]
}

export const useWsBaseListAll = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const baseListAllData = ref<BaseListAllData | null>(null)
  const isBaseListAllLoading = ref(false)

  const loadBaseListAll = async (force = false) => {
    if (!force && (baseListAllData.value || isBaseListAllLoading.value)) return

    isBaseListAllLoading.value = true
    try {
      baseListAllData.value = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'baseListAll',
      })) as BaseListAllData
    } catch {
      // silently fail — cross-workspace search won't be available
    } finally {
      isBaseListAllLoading.value = false
    }
  }

  // Map of workspace ID → plan info
  const baseListAllWsMap = computed(() => {
    const map = new Map<string, { plan_title: string | null }>()
    for (const ws of baseListAllData.value?.workspaces ?? []) {
      map.set(ws.id, { plan_title: ws.plan_title })
    }
    return map
  })

  // Workspace IDs that have at least one base title matching a search query
  const getBaseMatchCountByWs = (query: string) => {
    if (!query || !baseListAllData.value) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const ws of baseListAllData.value.workspaces) {
      const count = ws.bases.filter((b) => searchCompare(b.title, query)).length
      if (count > 0) map.set(ws.id, count)
    }
    return map
  }

  return {
    baseListAllData,
    isBaseListAllLoading,
    loadBaseListAll,
    baseListAllWsMap,
    getBaseMatchCountByWs,
  }
})
