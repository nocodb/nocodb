import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export function useSharedView(viewId: string) {
  const sharedView = ref<ViewType>()
  const meta = ref<TableType>(() => sharedView.value.model)
  const columns = ref<ColumnType[]>(() => sharedView.value?.model?.columns ?? [])

  const { $api } = useNuxtApp()
  const { setMeta } = useMetas()

  const loadSharedView = async () => {
    const viewMeta = await $api.public.sharedViewMetaGet(viewId)
    sharedView.value = viewMeta
    meta.value = sharedView.value.model
    columns.value = sharedView.value.model.columns

    setMeta(viewMeta.model)

    const relatedMetas = { ...viewMeta.relatedMetas }
    Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))
  }

  return { sharedView, loadSharedView, meta, columns }
}
