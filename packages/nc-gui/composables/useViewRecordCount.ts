import type { TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { normalizeViewRecordCountSettings, viewRecordCountKey, viewRecordCountRefreshMs } from '~/utils/viewRecordCount'
import { useViewRecordCountsStore } from '~/store/viewRecordCounts'
import { useViewRecordCountRoles } from '~/composables/useViewRecordCountRoles'

/** Fetch only for displayed sidebar nodes, and count the saved view rather than the active view's transient filters. */
export function useViewRecordCount(view: Ref<ViewType>, table: Ref<TableType>, visible: Ref<boolean>) {
  const state = useViewRecordCountsStore()
  const { identity, revision } = storeToRefs(state)
  const { user, token } = useGlobal()
  const { isUIAllowed } = useRoles()
  const isPublic = inject(IsPublicInj, ref(false))
  const documentVisibility = useDocumentVisibility()
  const settings = computed(() => normalizeViewRecordCountSettings(view.value?.meta))
  const interval = computed(() => viewRecordCountRefreshMs(settings.value))
  const roles = useViewRecordCountRoles(computed(() => table.value?.base_id))
  const roleKey = computed(() =>
    JSON.stringify(
      Object.keys(roles.value)
        .filter((role) => roles.value[role])
        .sort(),
    ),
  )
  const target = computed(() => ({
    baseId: table.value?.base_id || '',
    tableId: table.value?.id || '',
    viewId: view.value?.id || '',
    roleScope: roleKey.value,
  }))
  const targetKey = computed(() => viewRecordCountKey(target.value))
  const allowed = computed(
    () =>
      !!target.value.baseId &&
      !!target.value.tableId &&
      !!target.value.viewId &&
      !!user.value?.id &&
      view.value?.type !== ViewTypes.FORM &&
      !isPublic.value &&
      Object.values(roles.value).some(Boolean) &&
      isUIAllowed('viewRecordCount', { roles: roles.value }) &&
      (settings.value.showCount || settings.value.boldWhenNonEmpty),
  )
  const active = computed(() => allowed.value && visible.value && documentVisibility.value === 'visible')
  const entry = computed(() => {
    // The cache is deliberately non-reactive; one revision wakes all consumers after a deduplicated request.
    void revision.value
    return state.cache.get(target.value)
  })
  const count = computed(() => (allowed.value ? entry.value?.count : undefined))
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let refreshGeneration = 0

  function stopTimer() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  async function refresh() {
    const generation = ++refreshGeneration
    stopTimer()
    if (disposed || !active.value || typeof window === 'undefined') return
    const key = targetKey.value
    await state.cache.load(target.value, interval.value, () => !disposed && active.value && key === targetKey.value)
    if (disposed || generation !== refreshGeneration || !active.value || key !== targetKey.value || entry.value?.forbidden) return
    const dueAt = entry.value?.retryAt ?? (entry.value?.checkedAt ?? Date.now()) + interval.value
    // Browsers clamp delays above 2^31-1 ms. Wake up in chunks for long day intervals.
    timer = setTimeout(refresh, Math.min(Math.max(1, dueAt - Date.now()), 2 ** 31 - 1))
  }

  watch([targetKey, active, interval, identity, token, roleKey], refresh, { immediate: true })
  onScopeDispose(() => {
    disposed = true
    refreshGeneration++
    stopTimer()
  })

  return { count, settings }
}
