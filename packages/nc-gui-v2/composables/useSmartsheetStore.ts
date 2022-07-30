import { computed } from '@vue/reactivity'
import { createInjectionState } from '@vueuse/core'
import type { TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'
import useProject from '~/composables/useProject'

const [useProvideSmartsheetStore, useSmartsheetStore] = createInjectionState((view: Ref<ViewType>, meta: Ref<TableType>) => {
  const { $api } = useNuxtApp()
  const { sqlUi } = useProject()

  // state
  // todo: move to grid view store
  const search = reactive({
    field: '',
    value: '',
  })

  // getters
  const isLocked = computed(() => view?.value?.lock_type === 'locked')
  const xWhere = computed(() => {
    let where
    const col = meta?.value?.columns?.find(({ id }) => id === search.field) || meta?.value?.columns?.find((v) => v.pv)
    if (!col) return

    if (!search.value.trim()) return
    if (['text', 'string'].includes(sqlUi.value.getAbstractType(col)) && col.dt !== 'bigint') {
      where = `(${col.title},like,%${search.value.trim()}%)`
    } else {
      where = `(${col.title},eq,${search.value.trim()})`
    }
    return where
  })

  // actions

  return {
    view,
    meta,
    isLocked,
    $api,
    search,
    xWhere,
  }
})

export { useProvideSmartsheetStore }

export function useSmartsheetStoreOrThrow() {
  const smartsheetStore = useSmartsheetStore()
  if (smartsheetStore == null) throw new Error('Please call `useSmartsheetStore` on the appropriate parent component')
  return smartsheetStore
}
