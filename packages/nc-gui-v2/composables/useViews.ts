import type { TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

export default function (meta: Ref<TableType>) {
  const views = ref()
  const { $api } = useNuxtApp()

  const loadViews = async () => {
    if (meta.value?.id) views.value = (await $api.dbView.list(meta.value?.id)).list
  }

  return { views, loadViews }
}
