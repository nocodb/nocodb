import type { ColumnType, TableType } from 'nocodb-sdk'
import { useMetas } from './useMetas'

export function useManyToMany(column: ColumnType) {
  const { metas, getMeta } = useMetas()
  const childMeta = computed<TableType>(() => {
    return metas.value?.[(column.colOptions as any)?.fk_related_model_id as string]
  })

  const loadChildMeta = async () => {
    await getMeta((column.colOptions as any)?.fk_related_model_id as string)
  }

  const primaryValueProp = computed(() => {
    return (childMeta?.value?.columns?.find((c) => c.pv) || childMeta?.value?.columns?.[0])?.title
  })

  return { childMeta, loadChildMeta, primaryValueProp }
}
