import { type ColumnType, ROW_COLORING_MODE, type RowColoringInfo, type TableType, type ViewType } from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'

export function useViewRowColorOption(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: Ref<ViewType>
  rowColorInfo?: Ref<RowColoringInfo>
}) {
  const { $api } = useNuxtApp()
  const { rowColorInfo: dbRowColorInfo } = useViewRowColor({
    ...params,
    rows: [],
  })

  const rowColorInfo = ref(
    dbRowColorInfo.value ?? {
      mode: null,
    },
  )

  return { rowColorInfo }
}
