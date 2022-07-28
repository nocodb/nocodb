import { createInjectionState } from '@vueuse/core'
import type { TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

const [useProvideSmartsheetStore, useSmartsheetStore] = createInjectionState((view: Ref<ViewType>, meta: Ref<TableType>) => {
  const { $api } = useNuxtApp()

  // state

  // getters
  const isLocked = computed(() => view?.value?.lock_type === 'locked')

  // actions

  return {
    view,
    meta,
    isLocked,
    $api,
  }
})

export { useProvideSmartsheetStore }

export function useSmartsheetStoreOrThrow() {
  const smartsheetStore = useSmartsheetStore()
  if (smartsheetStore == null) throw new Error('Please call `useSmartsheetStore` on the appropriate parent component')
  return smartsheetStore
}
