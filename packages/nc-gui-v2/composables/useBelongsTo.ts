import type { ColumnType, TableType } from 'nocodb-sdk'
import useMetas from './useMetas'

export function useBelongsTo(column: ColumnType) {
  const { metas, getMeta } = useMetas()
  const parentMeta = computed<TableType>(() => {
    return metas.value?.[(column.colOptions as any)?.fk_related_model_id as string]
  })

  const loadParentMeta = async () => {
    await getMeta((column.colOptions as any)?.fk_related_model_id as string)
  }

  const primaryValueProp = computed(() => {
    return (parentMeta?.value?.columns?.find((c) => c.pv) || parentMeta?.value?.columns?.[0])?.title
  })

  return { parentMeta, loadParentMeta, primaryValueProp }
}
