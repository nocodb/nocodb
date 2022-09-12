import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, TableType, ViewType } from 'nocodb-sdk'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import type { Row } from '~/composables/useViewData'
import { useNuxtApp } from '#app'

export function useKanbanViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }> | undefined,
  where?: ComputedRef<string | undefined>,
) {
  const { t } = useI18n()
  const isPublic = inject(IsPublicInj, ref(false))
  const { api } = useApi()
  const { project } = useProject()
  const { $api, $e } = useNuxtApp()
  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()
  const { isUIAllowed } = useUIPermission()
  const groupingFieldColOptions = useState<Record<string, any>[]>('KanbanGroupingFieldColOptions', () => [])
  const kanbanMetaData = useState<KanbanType>('KanbanMetaData', () => ({}))
  // {
  //   [val1] : [
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     ...
  //   ],
  //   [val2] : [
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     ...
  //   ],
  // }
  const formattedData = useState<Record<string, Row[]>>('KanbanFormattedData', () => ({}))
  const groupingField = useState<string>('KanbanGroupingField', () => '')

  const formatData = (list: Record<string, any>[]) =>
    list.map((row) => ({
      row: { ...row },
      oldRow: { ...row },
      rowMeta: {},
    }))

  async function loadKanbanData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
    // each stack only loads 25 records -> scroll to load more (to be integrated with infinite scroll)
    // TODO: integrate with infinite scroll
    // TODO: handle share view case
    if ((!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) && !isPublic.value) return

    // reset formattedData to avoid storing previous data
    // after changing grouping field
    formattedData.value = {}

    // grouping field column options
    const groupingFieldColumn = meta?.value?.columns?.filter((f) => f.title === groupingField.value)[0] as Record<string, any>
    groupingFieldColOptions.value = [
      ...(groupingFieldColumn?.colOptions?.options ?? []),
      { id: 'uncategorized', title: 'Uncategorized', order: 0 },
    ].sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)

    await Promise.all(
      groupingFieldColOptions.value.map(async (option) => {
        let where = `(${groupingField.value},eq,${option.title})`
        if (option.title === 'Uncategorized') {
          where = `(${groupingField.value},is,null)`
        }
        const response = await api.dbViewRow.list('noco', project.value.id!, meta!.value.id!, viewMeta!.value.id, {
          ...params,
          ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          where,
        })
        formattedData.value[option.title] = formatData(response.list)
      }),
    )
  }

  async function loadKanbanMeta() {
    if (!viewMeta?.value?.id) return
    kanbanMetaData.value = await $api.dbView.kanbanRead(viewMeta.value.id)
    // set groupingField
    const groupingFieldCol = meta?.value?.columns?.filter((f) => f.id === kanbanMetaData?.value?.grp_column_id)[0]
    groupingField.value = groupingFieldCol?.title as string
  }

  async function insertRow(row: Record<string, any>, rowIndex = formattedData.value.uncatgorized?.length) {
    try {
      const insertObj = meta?.value?.columns?.reduce((o: any, col) => {
        if (!col.ai && row?.[col.title as string] !== null) {
          o[col.title as string] = row?.[col.title as string]
        }
        return o
      }, {})

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        project?.value.id as string,
        meta?.value.id as string,
        viewMeta?.value?.id as string,
        insertObj,
      )

      formattedData.value.uncatgorized?.splice(rowIndex ?? 0, 1, {
        row: insertedData,
        rowMeta: {},
        oldRow: { ...insertedData },
      })

      return insertedData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  async function updateRowProperty(toUpdate: Row, property: string) {
    try {
      const id = extractPkFromRow(toUpdate.row, meta?.value.columns as ColumnType[])

      const updatedRowData = await $api.dbViewRow.update(
        NOCO,
        project?.value.id as string,
        meta?.value.id as string,
        viewMeta?.value?.id as string,
        id,
        {
          [property]: toUpdate.row[property],
        },
        // todo:
        // {
        //   query: { ignoreWebhook: !saved }
        // }
      )
      // audit
      $api.utils
        .auditRowUpdate(id, {
          fk_model_id: meta?.value.id as string,
          column_name: property,
          row_id: id,
          value: getHTMLEncodedText(toUpdate.row[property]),
          prev_value: getHTMLEncodedText(toUpdate.oldRow[property]),
        })
        .then(() => {})

      /** update row data(to sync formula and other related columns) */
      Object.assign(toUpdate.row, updatedRowData)
      Object.assign(toUpdate.oldRow, updatedRowData)
    } catch (e: any) {
      message.error(`${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  async function updateOrSaveRow(row: Row) {
    if (row.rowMeta.new) {
      await insertRow(row.row, formattedData.value[row.row.title].indexOf(row))
    } else {
      await updateRowProperty(row, groupingField.value)
    }
  }

  function addEmptyRow(addAfter = formattedData.value.Uncategorized?.length) {
    formattedData.value.Uncategorized.splice(addAfter, 0, {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    })

    return formattedData.value.Uncategorized[addAfter]
  }

  watch(groupingField, async (v) => await loadKanbanData())

  return {
    loadKanbanData,
    loadKanbanMeta,
    kanbanMetaData,
    formattedData,
    groupingField,
    groupingFieldColOptions,
    updateOrSaveRow,
    addEmptyRow,
  }
}
