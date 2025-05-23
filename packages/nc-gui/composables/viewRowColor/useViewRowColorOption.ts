import { type ColumnType, ROW_COLORING_MODE, type RowColoringInfo, type TableType, type ViewType } from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'

export function useViewRowColorOption(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: Ref<ViewType>
}) {
  const { $api } = useNuxtApp()

  const dbRowColorInfo: Ref<RowColoringInfo> = inject(ViewRowColorInj)

  const rowColorInfo = ref(
    dbRowColorInfo.value ?? {
      mode: null,
    },
  )

  watch(
    () => dbRowColorInfo,
    (oldValue, newValue) => {
      if (newValue?.value) {
        rowColorInfo.value = newValue.value
      }
    },
  )

  const onDropdownOpen = () => {
    rowColorInfo.value = dbRowColorInfo.value ?? {
      mode: null,
    }
  }

  const onRemoveRowColoringMode = () => {
    rowColorInfo.value.mode = null
  }

  const onRowColorSelectChange = () => {
    
  }

  return { rowColorInfo, onDropdownOpen, onRemoveRowColoringMode }
}
