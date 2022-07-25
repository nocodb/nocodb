import type { ColumnType, TableType } from 'nocodb-sdk'
import type LinkToAnotherRecordColumn from '../../nocodb/src/lib/models/LinkToAnotherRecordColumn'
import useMetas from '~/composables/useMetas'

export default function (column: ColumnType) {
  const { metas, getMeta } = useMetas()
  const parentMeta = computed<TableType>(() => {
    return metas.value?.[(column.colOptions as LinkToAnotherRecordColumn)?.fk_related_model_id as string]
  })

  const loadParentMeta = async () => {
    await getMeta((column.colOptions as LinkToAnotherRecordColumn)?.fk_related_model_id as string)
  }

  const primaryValueProp = computed(() => {
    return (parentMeta?.value?.columns?.find((c) => c.pv) || parentMeta?.value?.columns?.[0])?.title
  })

  return { parentMeta, loadParentMeta, primaryValueProp }
}
