import type { FormType, GalleryType, GridType, KanbanType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

export default function (meta: Ref<TableType>) {
  const views = ref<(GridType | FormType | KanbanType | GalleryType)[]>()
  const { $api } = useNuxtApp()

  const loadViews = async () => {
    if (meta.value?.id)
      views.value = (await $api.dbView.list(meta.value?.id)).list as (GridType | FormType | KanbanType | GalleryType)[]
  }

  return { views, loadViews }
}
