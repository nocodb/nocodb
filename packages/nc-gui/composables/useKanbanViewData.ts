import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, TableType, ViewType } from 'nocodb-sdk'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import type { Row } from '~/composables/useViewData'
import { enumColor } from '~/utils'
import { useNuxtApp } from '#app'

export function useKanbanViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }> | undefined,
) {
  const { t } = useI18n()
  const isPublic = inject(IsPublicInj, ref(false))
  const { api } = useApi()
  const { project } = useProject()
  const { $api } = useNuxtApp()
  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()
  const { isUIAllowed } = useUIPermission()
  const groupingFieldColOptions = useState<Record<string, any>[]>('KanbanGroupingFieldColOptions', () => [])
  const kanbanMetaData = useState<KanbanType>('KanbanMetaData', () => ({}))
  // formattedData structure
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
  const groupingFieldColumn = useState<Record<string, any>>('KanbanGroupingFieldColumn', () => ({}))

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

    // reset formattedData to avoid storing previous data after changing grouping field
    formattedData.value = {}

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
    groupingFieldColumn.value = meta?.value?.columns?.filter((f) => f.id === kanbanMetaData?.value?.grp_column_id)[0] || {}
    groupingField.value = groupingFieldColumn.value?.title as string

    const { grp_column_id, stack_meta } = kanbanMetaData.value

    const stackMetaObj = stack_meta ? JSON.parse(stack_meta as string) : {}

    if (stackMetaObj && grp_column_id && stackMetaObj[grp_column_id] && groupingFieldColumn.value?.colOptions?.options) {
      // keep the existing order (index of the array) but update the values
      for (const option of groupingFieldColumn.value.colOptions.options) {
        const idx = stackMetaObj[grp_column_id].findIndex((ele: Record<string, any>) => ele.id === option.id)
        if (idx !== -1) {
          // update the option in stackMetaObj
          stackMetaObj[grp_column_id][idx] = option
        } else {
          // new option found
          const len = stackMetaObj[grp_column_id].length
          stackMetaObj[grp_column_id][len] = option
        }
      }
      // handle deleted options
      const columnOptionIds = groupingFieldColumn.value.colOptions.options.map(({ id }) => id)
      stackMetaObj[grp_column_id]
        .filter(({ id }) => id !== 'uncategorized' && !columnOptionIds.includes(id))
        .forEach(({ id }) => {
          const idx = stackMetaObj[grp_column_id].map((ele: Record<string, any>) => ele.id).indexOf(id)
          if (idx !== -1) {
            stackMetaObj[grp_column_id].splice(idx, 1)
          }
        })
      groupingFieldColOptions.value = stackMetaObj[grp_column_id]
    } else {
      // build stack meta
      groupingFieldColOptions.value = [
        ...(groupingFieldColumn.value.colOptions.options ?? []),
        // enrich uncategorized stack
        { id: 'uncategorized', title: 'Uncategorized', order: 0, color: enumColor.light[2] },
      ].sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)
    }
    // if grouping column id is present, add the grouping field column options to stackMetaObj
    if (grp_column_id) {
      stackMetaObj[grp_column_id] = groupingFieldColOptions.value
      await updateKanbanMeta({
        stack_meta: stackMetaObj,
      })
    }
  }

  async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
    if (!viewMeta?.value?.id) return
    await $api.dbView.kanbanUpdate(viewMeta.value.id, {
      ...kanbanMetaData.value,
      ...updateObj,
    })
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

  return {
    loadKanbanData,
    loadKanbanMeta,
    updateKanbanMeta,
    kanbanMetaData,
    formattedData,
    groupingField,
    groupingFieldColOptions,
    groupingFieldColumn,
    updateOrSaveRow,
    addEmptyRow,
  }
}
