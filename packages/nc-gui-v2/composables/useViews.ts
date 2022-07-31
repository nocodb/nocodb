import type { FormType, GalleryType, GridType, KanbanType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp } from '#app'

export default function (meta: MaybeRef<TableType | undefined>) {
  let views = $ref<(GridType | FormType | KanbanType | GalleryType)[]>([])
  const { $api } = useNuxtApp()

  const loadViews = async () => {
    const _meta = unref(meta)

    if (_meta && _meta.id) {
      const response = (await $api.dbView.list(_meta.id)).list as any[]
      if (response) {
        views = response.sort((a, b) => a.order - b.order)
      }
    }
  }

  watch(() => meta, loadViews, { immediate: true })

  return { views: $$(views), loadViews }
}
