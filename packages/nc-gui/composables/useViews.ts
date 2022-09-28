import type { TableType, ViewType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { unref, useNuxtApp, watch } from '#imports'

export function useViews(meta: MaybeRef<TableType | undefined>) {
  let views = $ref<ViewType[]>([])

  const { $api } = useNuxtApp()


  const loadViews = async () => {
    const _meta = unref(meta)

    if (_meta && _meta.id) {
      const response = (await $api.dbView.list(_meta.id)).list as ViewType[]
      if (response) {
        views = response.sort((a, b) => a.order! - b.order!)
      }
    }
  }

  watch(meta, loadViews, { immediate: true })

  return { views: $$(views), loadViews }
}
