import { UITypes, isDateType } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import type { Ref } from 'vue'

/**
 * Link fields whose linked display value is a date, keyed by link column id.
 * Filtering such a link compares against that date, not the text the link shows.
 */
export function useDateDisplayLinkFields(columns: Ref<ColumnType[]>, enabled: Ref<boolean>) {
  const { getMeta } = useMetas()

  const dateDisplayLinkFields = computedAsync<Record<string, ColumnType>>(async () => {
    if (!enabled.value) return {}

    const result: Record<string, ColumnType> = {}
    for (const column of columns.value) {
      if (column.uidt !== UITypes.LinkToAnotherRecord) continue

      const colOptions = column.colOptions as LinkToAnotherRecordType | undefined
      if (!colOptions?.fk_related_model_id) continue

      const relatedMeta = await getMeta(
        colOptions.fk_related_base_id ?? column.base_id!,
        colOptions.fk_related_model_id,
        false,
        false,
        true,
      )
      const overrideId = colOptions.fk_display_value_column_id
      const displayColumn =
        (overrideId && relatedMeta?.columns?.find((c) => c.id === overrideId)) || relatedMeta?.columns?.find((c) => c.pv)
      if (displayColumn && isDateType(displayColumn.uidt as UITypes)) {
        result[column.id!] = displayColumn
      }
    }
    return result
  }, {})

  return { dateDisplayLinkFields }
}
