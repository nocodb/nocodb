import { message } from 'ant-design-vue'
import { UITypes } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, RelationTypes, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { MaybeRef } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { Row } from './useViewData'
import {
  NOCO,
  computed,
  deepCompare,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  ref,
  unref,
  useInjectionState,
  useMetas,
  useNuxtApp,
  useProject,
  useVirtualCell,
} from '#imports'

const [useProvideSmartsheetRowStore, useSmartsheetRowStore] = useInjectionState((meta: Ref<TableType>, row: MaybeRef<Row>) => {
  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const { project } = useProject()

  const { metas } = useMetas()

  const currentRow = ref(row)

  // state
  const state = ref<Record<string, Record<string, any> | Record<string, any>[] | null>>({})

  // getters
  const isNew = computed(() => unref(row).rowMeta?.new ?? false)

  // actions
  const addLTARRef = async (value: Record<string, any>, column: ColumnType) => {
    const { isHm, isMm, isBt } = $(useVirtualCell(ref(column)))
    if (isHm || isMm) {
      if (!state.value[column.title!]) state.value[column.title!] = []

      if (state.value[column.title!]!.find((ln: Record<string, any>) => deepCompare(ln, value))) {
        // This value is already in the list
        return message.info(t('msg.info.valueAlreadyInList'))
      }

      state.value[column.title!]!.push(value)
    } else if (isBt) {
      state.value[column.title!] = value
    }
  }

  // actions
  const removeLTARRef = async (value: Record<string, any>, column: ColumnType) => {
    const { isHm, isMm, isBt } = $(useVirtualCell(ref(column)))
    if (isHm || isMm) {
      state.value[column.title!]?.splice(state.value[column.title!]?.indexOf(value), 1)
    } else if (isBt) {
      state.value[column.title!] = null
    }
  }

  const linkRecord = async (rowId: string, relatedRowId: string, column: ColumnType, type: RelationTypes) => {
    try {
      await $api.dbTableRow.nestedAdd(
        NOCO,
        project.value.title as string,
        meta.value.title as string,
        rowId,
        type as 'mm' | 'hm',
        column.title as string,
        relatedRowId,
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  /** sync LTAR relations kept in local state */
  const syncLTARRefs = async (row: Record<string, any>) => {
    const id = extractPkFromRow(row, meta.value.columns as ColumnType[])
    for (const column of meta?.value?.columns ?? []) {
      if (column.uidt !== UITypes.LinkToAnotherRecord) continue
      const colOptions = column?.colOptions as LinkToAnotherRecordType

      const { isHm, isMm, isBt } = $(useVirtualCell(ref(column)))
      const relatedTableMeta = metas.value?.[colOptions?.fk_related_model_id as string]

      if (isHm || isMm) {
        const relatedRows = (state.value?.[column.title!] ?? []) as Record<string, any>[]
        for (const relatedRow of relatedRows) {
          await linkRecord(
            id,
            extractPkFromRow(relatedRow, relatedTableMeta.columns as ColumnType[]),
            column,
            colOptions.type as RelationTypes,
          )
        }
      } else if (isBt && state?.value?.[column.title!]) {
        await linkRecord(
          id,
          extractPkFromRow(state.value?.[column.title!] as Record<string, any>, relatedTableMeta.columns as ColumnType[]),
          column,
          colOptions.type as RelationTypes,
        )
      }
    }
  }

  const loadRow = async () => {
    const record = await $api.dbTableRow.read(
      NOCO,
      project?.value?.id as string,
      meta.value.title,
      extractPkFromRow(ref(row).value?.row, meta.value.columns as ColumnType[]),
    )
    Object.assign(ref(row).value, {
      row: record,
      oldRow: { ...record },
      rowMeta: {},
    })
  }

  return {
    row,
    state,
    isNew,
    // todo: use better name
    addLTARRef,
    removeLTARRef,
    syncLTARRefs,
    loadRow,
    currentRow,
  }
}, 'smartsheet-row-store')

export { useProvideSmartsheetRowStore }

export function useSmartsheetRowStoreOrThrow() {
  const smartsheetRowStore = useSmartsheetRowStore()

  if (smartsheetRowStore == null) throw new Error('Please call `useSmartsheetRowStore` on the appropriate parent component')

  return smartsheetRowStore
}
