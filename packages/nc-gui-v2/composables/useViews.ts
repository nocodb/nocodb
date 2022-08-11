import type { TableType, ViewType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp } from '#app'

export function useViews(meta: MaybeRef<TableType | undefined>) {
  const views = $ref<ViewType[]>([])
  const { $api } = useNuxtApp()

  const loadViews = async () => {
    const _meta = unref(meta)

    if (_meta && _meta.id) {
      const response = (await $api.dbView.list(_meta.id)).list
      if (response) {
        // views = response.sort((a, b) => a.order! - b.order!)
      }
    }
  }

  watch(() => meta, loadViews, { immediate: true })

  return { views: $$(views), loadViews }
}
