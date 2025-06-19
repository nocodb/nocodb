import { type ColumnType, ROW_COLORING_MODE, type RowColoringInfo, type TableType, type ViewType } from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'

export function useViewRowColorOption(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: Ref<ViewType>
}) {
  const { $api } = useNuxtApp()
  const eventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)

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

  const onRemoveRowColoringMode = async () => {
    await $api.dbView.deleteViewRowColor(params.view.value.id)
    rowColorInfo.value = { mode: null }
    eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
  }

  const onRowColorSelectChange = async () => {
    if (rowColorInfo.value.fk_column_id) {
      await $api.dbView.viewRowColorSelectAdd(params.view.value.id, rowColorInfo.value)
      eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
    }
  }

  return { rowColorInfo, onDropdownOpen, onRemoveRowColoringMode, onRowColorSelectChange }
}
