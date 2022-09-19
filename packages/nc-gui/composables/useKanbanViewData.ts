import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, SelectOptionType, SelectOptionsType, TableType, ViewType } from 'nocodb-sdk'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import type { Row } from '~/composables/useViewData'
import { deepCompare, enumColor } from '~/utils'
import { useNuxtApp } from '#app'

type GroupingFieldColOptionsType = SelectOptionType & { collapsed: boolean }

export function useKanbanViewData(
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
) {
  if (!meta) {
    throw new Error('Table meta is not available')
  }

  const { t } = useI18n()
  const { api } = useApi()
  const { project } = useProject()
  const { $api } = useNuxtApp()
  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()
  const { isUIAllowed } = useUIPermission()
  const isPublic = inject(IsPublicInj, ref(false))

  // kanban view meta data
  const kanbanMetaData = useState<KanbanType>('KanbanMetaData', () => ({}))

  // grouping field column options - e.g. title, fk_column_id, color etc
  const groupingFieldColOptions = useState<GroupingFieldColOptionsType[]>('KanbanGroupingFieldColOptions', () => [])

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

  // countByStack structure
  // {
  //   "uncategorized": 0,
  //   [val1]: 10,
  //   [val2]: 20
  // }
  const countByStack = useState<Record<string, number>>('KanbanCountByStack', () => ({}))

  // grouping field title
  const groupingField = useState<string>('KanbanGroupingField', () => '')

  // grouping field column
  const groupingFieldColumn = useState<ColumnType | undefined>('KanbanGroupingFieldColumn')

  // stack meta in object format
  const stackMetaObj = useState<Record<string, GroupingFieldColOptionsType[]>>('KanbanStackMetaObj', () => ({}))

  const formatData = (list: Record<string, any>[]) =>
    list.map((row) => ({
      row: { ...row },
      oldRow: { ...row },
      rowMeta: {},
    }))

  async function loadKanbanData() {
    if ((!project?.value?.id || !meta.value?.id || !viewMeta?.value?.id) && !isPublic.value) return

    // reset formattedData & countByStack to avoid storing previous data after changing grouping field
    formattedData.value = {}
    countByStack.value = {}

    await Promise.all(
      groupingFieldColOptions.value.map(async (option: GroupingFieldColOptionsType) => {
        const where =
          option.title === 'uncategorized' ? `(${groupingField.value},is,null)` : `(${groupingField.value},eq,${option.title})`
        const response = await api.dbViewRow.list('noco', project.value.id!, meta.value!.id!, viewMeta.value!.id!, {
          where,
        })

        formattedData.value[option.title!] = formatData(response.list)
        countByStack.value[option.title!] = response.pageInfo.totalRows || 0
      }),
    )
  }

  async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
    if ((!project?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return
    let where = `(${groupingField.value},eq,${stackTitle})`
    if (stackTitle === 'uncategorized') {
      where = `(${groupingField.value},is,null)`
    }
    const response = await api.dbViewRow.list('noco', project.value.id!, meta.value!.id!, viewMeta.value!.id!, {
      ...params,
      ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
      ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
      where,
    })
    formattedData.value[stackTitle] = [...formattedData.value[stackTitle], ...formatData(response.list)]
  }

  async function loadKanbanMeta() {
    if (!viewMeta?.value?.id || !meta?.value?.columns) return
    kanbanMetaData.value = await $api.dbView.kanbanRead(viewMeta.value.id)
    // set groupingField
    groupingFieldColumn.value = meta.value.columns.filter((f: ColumnType) => f.id === kanbanMetaData.value.grp_column_id)[0] || {}

    groupingField.value = groupingFieldColumn.value.title!

    const { grp_column_id, stack_meta } = kanbanMetaData.value

    stackMetaObj.value = stack_meta ? JSON.parse(stack_meta as string) : {}

    if (stackMetaObj.value && grp_column_id && stackMetaObj.value[grp_column_id]) {
      // keep the existing order (index of the array) but update the values done outside kanban
      let isChanged = false
      for (const option of (groupingFieldColumn.value.colOptions as SelectOptionsType).options) {
        const idx = stackMetaObj.value[grp_column_id].findIndex((ele) => ele.id === option.id)
        if (idx !== -1) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { collapsed, ...rest } = stackMetaObj.value[grp_column_id][idx]
          if (!deepCompare(rest, option)) {
            // update the option in stackMetaObj
            stackMetaObj.value[grp_column_id][idx] = {
              ...stackMetaObj.value[grp_column_id][idx],
              ...option,
            }
            isChanged = true
          }
        } else {
          // new option found - add to stackMetaObj
          stackMetaObj.value[grp_column_id].push({
            ...option,
            collapsed: false,
          })
          formattedData.value[option.title!] = []
          countByStack.value[option.title!] = 0
          isChanged = true
        }
      }

      // handle deleted options
      const columnOptionIds = (groupingFieldColumn.value?.colOptions as SelectOptionsType)?.options.map(({ id }) => id)
      stackMetaObj.value[grp_column_id]
        .filter(({ id }) => id !== 'uncategorized' && !columnOptionIds.includes(id))
        .forEach(({ id }) => {
          const idx = stackMetaObj.value[grp_column_id].map((ele: Record<string, any>) => ele.id).indexOf(id)
          if (idx !== -1) {
            deleteStack(stackMetaObj.value[grp_column_id][idx].title!)
            stackMetaObj.value[grp_column_id].splice(idx, 1)
          }
        })

      groupingFieldColOptions.value = stackMetaObj.value[grp_column_id]
      if (isChanged) {
        await updateKanbanStackMeta()
      }
    } else {
      // build stack meta
      groupingFieldColOptions.value = [
        ...((groupingFieldColumn.value?.colOptions as SelectOptionsType & { collapsed: boolean })?.options ?? []),
        // enrich uncategorized stack
        { id: 'uncategorized', title: 'uncategorized', order: 0, color: enumColor.light[2] },
      ]
        // sort by initial order
        .sort((a, b) => a.order! - b.order!)
        // enrich `collapsed`
        .map((ele) => ({
          ...ele,
          collapsed: false,
        }))
      await updateKanbanStackMeta()
    }
  }

  async function updateKanbanStackMeta() {
    const { grp_column_id } = kanbanMetaData.value
    if (grp_column_id) {
      stackMetaObj.value[grp_column_id] = groupingFieldColOptions.value
      await updateKanbanMeta({
        stack_meta: stackMetaObj.value,
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
        meta.value?.id as string,
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
      const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

      const updatedRowData = await $api.dbViewRow.update(
        NOCO,
        project?.value.id as string,
        meta.value?.id as string,
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
          fk_model_id: meta.value?.id as string,
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

  async function deleteStack(stackTitle: string) {
    try {
      // set groupingField to null for all records under the target stack
      await api.dbTableRow.bulkUpdateAll(
        'noco',
        project.value.id!,
        meta.value?.id as string,
        {
          [groupingField.value]: null,
        },
        {
          where: `(${groupingField.value},eq,${stackTitle})`,
        },
      )
      // update to groupingField value to null
      formattedData.value[stackTitle] = formattedData.value[stackTitle].map((o) => ({
        ...o,
        row: {
          ...o.row,
          [groupingField.value]: null,
        },
        oldRow: {
          ...o.oldRow,
          [groupingField.value]: null,
        },
      }))
      // merge the 'deleted' stack to uncategorized stack
      formattedData.value.uncategorized = [...formattedData.value.uncategorized, ...formattedData.value[stackTitle]]
      countByStack.value.uncategorized += countByStack.value[stackTitle]
      // clear the 'deleted' stack
      formattedData.value[stackTitle] = []
      countByStack.value[stackTitle] = 0
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  function addEmptyRow(addAfter = formattedData.value.uncategorized?.length) {
    formattedData.value.uncategorized.splice(addAfter, 0, {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    })
    return formattedData.value.uncategorized[addAfter]
  }

  return {
    loadKanbanData,
    loadMoreKanbanData,
    loadKanbanMeta,
    updateKanbanMeta,
    kanbanMetaData,
    formattedData,
    countByStack,
    groupingField,
    groupingFieldColOptions,
    groupingFieldColumn,
    updateOrSaveRow,
    addEmptyRow,
    deleteStack,
    updateKanbanStackMeta,
  }
}
