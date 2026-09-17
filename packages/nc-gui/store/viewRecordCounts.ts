import { defineStore } from 'pinia'
import { createViewRecordCountCache } from '~/utils/viewRecordCount'

/** Per-app, per-session counts survive sidebar collapse without persisting user-specific data to storage. */
export const useViewRecordCountsStore = defineStore('viewRecordCounts', () => {
  const { $api } = useNuxtApp()
  const { user, token } = useGlobal()
  const revision = ref(0)
  const cache = createViewRecordCountCache(
    async ({ baseId, tableId, viewId }) => {
      const { count } = await $api.dbViewRow.count(NOCO, baseId, tableId, viewId)
      return count
    },
    () => revision.value++,
  )

  const identity = computed(() =>
    JSON.stringify([user.value?.id, user.value?.roles, user.value?.base_roles, user.value?.workspace_roles]),
  )
  watch([identity, token], () => cache.clear(), { flush: 'sync' })
  onScopeDispose(() => cache.clear())

  return { cache, revision, identity }
})
