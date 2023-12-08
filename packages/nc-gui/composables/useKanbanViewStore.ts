import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, SelectOptionType, SelectOptionsType, TableType, ViewType } from 'nocodb-sdk'
import type { Row, UndoRedoAction } from '#imports'
import {
  IsPublicInj,
  SharedViewPasswordInj,
  deepCompare,
  enumColor,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  inject,
  message,
  parseProp,
  provide,
  ref,
  rowPkData,
  storeToRefs,
  useApi,
  useBase,
  useFieldQuery,
  useI18n,
  useInjectionState,
  useNuxtApp,
  useRoles,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
} from '#imports'

type GroupingFieldColOptionsType = SelectOptionType & { collapsed: boolean }

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | KanbanType | undefined>,
    viewMeta: Ref<ViewType | KanbanType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
    shared = false,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const { t } = useI18n()

    const { api } = useApi()

    const { base, sqlUis } = storeToRefs(useBase())

    const { $e, $api } = useNuxtApp()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData, fetchSharedViewGroupedData } = useSharedView()

    const { isUIAllowed } = useRoles()

    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

    const password = ref<string | null>(null)

    const { search } = useFieldQuery()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    // save history of stack changes for undo/redo
    const moveHistory = ref<{ op: 'added' | 'removed'; pk: string; stack: string; index: number }[]>([])

    const sqlUi = ref(
      (meta.value as TableType)?.source_id ? sqlUis.value[(meta.value as TableType).source_id!] : Object.values(sqlUis.value)[0],
    )

    const xWhere = computed(() => {
      let where
      const col =
        (meta.value as TableType)?.columns?.find(({ id }) => id === search.value.field) ||
        (meta.value as TableType)?.columns?.find((v) => v.pv)
      if (!col) return

      if (!search.value.query.trim()) return
      if (['text', 'string'].includes(sqlUi.value.getAbstractType(col)) && col.dt !== 'bigint') {
        where = `(${col.title},like,%${search.value.query.trim()}%)`
      } else {
        where = `(${col.title},eq,${search.value.query.trim()})`
      }
      return where
    })

    provide(SharedViewPasswordInj, password)

    // kanban view meta data
    const kanbanMetaData = ref<KanbanType>({})

    // grouping field column options - e.g. title, fk_column_id, color etc
    const groupingFieldColOptions = ref<GroupingFieldColOptionsType[]>([])

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
    const formattedData = ref<Map<string | null, Row[]>>(new Map<string | null, Row[]>())

    // countByStack structure
    // {
    //   "uncategorized": 0,
    //   [val1]: 10,
    //   [val2]: 20
    // }
    const countByStack = ref<Map<string | null, number>>(new Map<string | null, number>())

    // grouping field title
    const groupingField = ref<string>('')

    // grouping field column
    const groupingFieldColumn = ref<ColumnType | undefined>()

    // stack meta in object format
    const stackMetaObj = ref<Record<string, GroupingFieldColOptionsType[]>>({})

    const shouldScrollToRight = ref(false)

    const formatData = (list: Record<string, any>[]) =>
      list.map((row) => ({
        row: { ...row },
        oldRow: { ...row },
        rowMeta: {},
      }))

    async function loadKanbanData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta?.value?.id || !groupingFieldColumn?.value?.id) && !isPublic.value)
        return

      // reset formattedData & countByStack to avoid storing previous data after changing grouping field
      formattedData.value = new Map<string | null, Row[]>()
      countByStack.value = new Map<string | null, number>()

      let groupData

      if (isPublic.value) {
        groupData = await fetchSharedViewGroupedData(groupingFieldColumn!.value!.id!, {
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
        })
      } else {
        groupData = await api.dbViewRow.groupedDataList(
          'noco',
          base.value.id!,
          meta.value!.id!,
          viewMeta.value!.id!,
          groupingFieldColumn!.value!.id!,
          { where: xWhere.value },
          {},
        )
      }

      for (const data of groupData ?? []) {
        const key = data.key
        formattedData.value.set(key, formatData(data.value.list))
        countByStack.value.set(key, data.value.pageInfo.totalRows || 0)
      }
    }

    async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return
      let where = `(${groupingField.value},eq,${stackTitle})`
      if (stackTitle === null) {
        where = `(${groupingField.value},is,null)`
      }

      if (xWhere.value) {
        where = `${where} and ${xWhere.value}`
      }

      const response = !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...params,
            ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            where,
          })
        : await fetchSharedViewData({
            ...params,
            sortsArr: sorts.value,
            filtersArr: nestedFilters.value,
            offset: params.offset,
            where,
          })

      formattedData.value.set(stackTitle, [...formattedData.value.get(stackTitle)!, ...formatData(response!.list!)])
    }

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      kanbanMetaData.value = isPublic.value
        ? (sharedView.value?.view as KanbanType)
        : await $api.dbView.kanbanRead(viewMeta.value.id)

      // set groupingField
      groupingFieldColumn.value = !isPublic.value
        ? (meta.value.columns as ColumnType[]).filter((f) => f.id === kanbanMetaData.value.fk_grp_col_id)[0] || {}
        : (parseProp(sharedView.value?.meta).groupingFieldColumn! as ColumnType)

      groupingField.value = groupingFieldColumn.value.title!

      const { fk_grp_col_id, meta: stack_meta } = kanbanMetaData.value

      stackMetaObj.value = stack_meta ? JSON.parse(stack_meta as string) : {}

      if (stackMetaObj.value && fk_grp_col_id && stackMetaObj.value[fk_grp_col_id]) {
        // keep the existing order (index of the array) but update the values done outside kanban
        let isChanged = false
        let hasNewOptionsAdded = false
        for (const option of (groupingFieldColumn.value.colOptions as SelectOptionsType)?.options ?? []) {
          const idx = stackMetaObj.value[fk_grp_col_id].findIndex((ele) => ele.id === option.id)
          if (idx !== -1) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { collapsed, ...rest } = stackMetaObj.value[fk_grp_col_id][idx]
            if (!deepCompare(rest, option)) {
              // update the option in stackMetaObj
              stackMetaObj.value[fk_grp_col_id][idx] = {
                ...stackMetaObj.value[fk_grp_col_id][idx],
                ...option,
              }
              // rename the key in formattedData & countByStack
              if (option.title !== rest.title) {
                // option.title is new key
                // rest.title is old key
                formattedData.value.set(option.title!, formattedData.value.get(rest.title!)!)
                countByStack.value.set(option.title!, countByStack.value.get(rest.title!)!)
                // update grouping field value under the edited stack
                await bulkUpdateGroupingFieldValue(option.title!)
              }
              isChanged = true
            }
          } else {
            // new option found - add to stackMetaObj
            stackMetaObj.value[fk_grp_col_id].push({
              ...option,
              collapsed: false,
            })
            formattedData.value.set(option.title!, [])
            countByStack.value.set(option.title!, 0)
            isChanged = true
            hasNewOptionsAdded = true
          }
        }

        // handle deleted options
        const columnOptionIds = (groupingFieldColumn.value?.colOptions as SelectOptionsType)?.options.map(({ id }) => id)
        const cols = stackMetaObj.value[fk_grp_col_id].filter(({ id }) => id !== 'uncategorized' && !columnOptionIds.includes(id))
        for (const col of cols) {
          const idx = stackMetaObj.value[fk_grp_col_id].map((ele: Record<string, any>) => ele.id).indexOf(col.id)
          if (idx !== -1) {
            stackMetaObj.value[fk_grp_col_id].splice(idx, 1)
            // there are two cases
            // 1. delete option from Add / Edit Stack in kanban view
            // 2. delete option from grid view, then switch to kanban view
            // for the second case, formattedData.value and countByStack.value would be empty at this moment
            // however, the data will be correct after rendering
            if (formattedData.value.size && countByStack.value.size && formattedData.value.has(col.title!)) {
              // for the first case, no reload is executed.
              // hence, we set groupingField to null for all records under the target stack
              await bulkUpdateGroupingFieldValue(col.title!, true)
              // merge the to-be-deleted stack to uncategorized stack
              formattedData.value.set(null, [...(formattedData.value.get(null) || []), ...formattedData.value.get(col.title!)!])
              // update the record count
              countByStack.value.set(null, (countByStack.value.get(null) || 0) + (countByStack.value.get(col.title!) || 0))
            }
            isChanged = true
          }
        }
        groupingFieldColOptions.value = stackMetaObj.value[fk_grp_col_id]

        if (isChanged) {
          await updateKanbanStackMeta()
          if (hasNewOptionsAdded) {
            shouldScrollToRight.value = true
          }
        }
      } else {
        // build stack meta
        groupingFieldColOptions.value = [
          ...((groupingFieldColumn.value?.colOptions as SelectOptionsType & { collapsed: boolean })?.options ?? []),
          // enrich uncategorized stack
          { id: 'uncategorized', title: null, order: 0, color: enumColor.light[2] } as any,
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
      const { fk_grp_col_id } = kanbanMetaData.value
      if (fk_grp_col_id) {
        stackMetaObj.value[fk_grp_col_id] = groupingFieldColOptions.value
        await updateKanbanMeta({
          meta: stackMetaObj.value,
        })
      }
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      await $api.dbView.kanbanUpdate(viewMeta.value.id, updateObj)
    }

    function findRowInState(rowData: Record<string, any>) {
      const pk: Record<string, string> = rowPkData(rowData, meta?.value?.columns as ColumnType[])
      for (const rows of formattedData.value.values()) {
        for (const row of rows) {
          if (Object.keys(pk).every((k) => pk[k] === row.row[k])) {
            return row
          }
        }
      }
    }

    async function insertRow(row: Record<string, any>, rowIndex = formattedData.value.get(null)!.length, undo = false) {
      try {
        const insertObj = (meta?.value?.columns as ColumnType[]).reduce((o: Record<string, any>, col) => {
          if ((!col.ai || undo) && row?.[col.title as string] !== null) {
            o[col.title!] = row?.[col.title as string]
          }
          return o
        }, {})

        const insertedData = await $api.dbViewRow.create(
          NOCO,
          base?.value.id as string,
          meta.value?.id as string,
          viewMeta?.value?.id as string,
          insertObj,
        )

        if (!undo) {
          const id = extractPkFromRow(insertedData, meta.value?.columns as ColumnType[])

          addUndo({
            redo: {
              fn: async function redo(this: UndoRedoAction, row: Row, rowIndex: number) {
                const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
                row.row = { ...pkData, ...row.row }
                await insertRow(row, rowIndex, true)
                addOrEditStackRow(row, true)
              },
              args: [clone(row), rowIndex],
            },
            undo: {
              fn: async function undo(this: UndoRedoAction, id: string) {
                await deleteRowById(id)
                const row = findRowInState(insertedData)
                if (row) removeRowFromTargetStack(row)
              },
              args: [id],
            },
            scope: defineViewScope({ view: viewMeta.value as ViewType }),
          })
        }

        formattedData.value.get(null)?.splice(rowIndex ?? 0, 1, {
          row: insertedData,
          rowMeta: {},
          oldRow: { ...insertedData },
        })

        return insertedData
      } catch (error: any) {
        message.error(await extractSdkResponseErrorMsg(error))
      }
    }

    async function updateRowProperty(toUpdate: Row, property: string, undo = false) {
      try {
        const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

        const updatedRowData = await $api.dbViewRow.update(
          NOCO,
          base?.value.id as string,
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

        if (!undo) {
          const oldRowIndex = moveHistory.value.find((ele) => ele.op === 'removed' && ele.pk === id)
          const nextRowIndex = moveHistory.value.find((ele) => ele.op === 'added' && ele.pk === id)
          addUndo({
            redo: {
              fn: async function redo(toUpdate: Row, property: string) {
                const updatedData = await updateRowProperty(toUpdate, property, true)
                const row = findRowInState(toUpdate.row)
                if (row) {
                  Object.assign(row.row, updatedData)
                  if (row.row[groupingField.value] !== row.oldRow[groupingField.value])
                    addOrEditStackRow(row, false, nextRowIndex?.index)
                  Object.assign(row.oldRow, updatedData)
                }
              },
              args: [clone(toUpdate), property],
            },
            undo: {
              fn: async function undo(toUpdate: Row, property: string) {
                const updatedData = await updateRowProperty(
                  { row: toUpdate.oldRow, oldRow: toUpdate.row, rowMeta: toUpdate.rowMeta },
                  property,
                  true,
                )
                const row = findRowInState(toUpdate.row)
                if (row) {
                  Object.assign(row.row, updatedData)
                  if (row.row[groupingField.value] !== row.oldRow[groupingField.value])
                    addOrEditStackRow(row, false, oldRowIndex?.index)
                  Object.assign(row.oldRow, updatedData)
                }
              },
              args: [clone(toUpdate), property],
            },
            scope: defineViewScope({ view: viewMeta.value as ViewType }),
          })

          /** update row data(to sync formula and other related columns) */
          Object.assign(toUpdate.row, updatedRowData)
          Object.assign(toUpdate.oldRow, updatedRowData)
        }

        return updatedRowData
      } catch (e: any) {
        message.error(`${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    async function updateOrSaveRow(row: Row) {
      if (row.rowMeta.new) {
        await insertRow(row.row, formattedData.value.get(row.row.title!)!.indexOf(row))
      } else {
        await updateRowProperty(row, groupingField.value)
      }
    }

    async function bulkUpdateGroupingFieldValue(stackTitle: string, moveToUncategorizedStack = false) {
      try {
        // set groupingField to target value for all records under the target stack
        // if isTargetValueNull is true, then it means the cards under stackTitle will move to Uncategorized stack
        const groupingFieldVal = moveToUncategorizedStack ? null : stackTitle
        await api.dbTableRow.bulkUpdateAll(
          'noco',
          base.value.id!,
          meta.value?.id as string,
          {
            [groupingField.value]: groupingFieldVal,
          },
          {
            where: `(${groupingField.value},eq,${stackTitle})`,
          },
        )
        if (formattedData.value.has(stackTitle)) {
          // update to groupingField value to target value
          formattedData.value.set(
            stackTitle,
            formattedData.value.get(stackTitle)!.map((o) => ({
              ...o,
              row: {
                ...o.row,
                [groupingField.value]: groupingFieldVal,
              },
              oldRow: {
                ...o.oldRow,
                [groupingField.value]: o.row[groupingField.value],
              },
            })),
          )
        }
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    async function deleteStack(stackTitle: string, stackIdx: number) {
      if (!viewMeta?.value?.id || !groupingFieldColumn.value) return
      try {
        // set groupingField to null for all records under the target stack
        await bulkUpdateGroupingFieldValue(stackTitle, true)
        // merge the to-be-deleted stack to uncategorized stack
        formattedData.value.set(null, [...formattedData.value.get(null)!, ...formattedData.value.get(stackTitle)!])
        countByStack.value.set(null, (countByStack.value.get(null) || 0) + (countByStack.value.get(stackTitle) || 0))
        // clear state for the to-be-deleted stack
        formattedData.value.delete(stackTitle)
        countByStack.value.delete(stackTitle)
        // delete the stack, i.e. grouping field value
        const newOptions = (groupingFieldColumn.value.colOptions as SelectOptionsType).options.filter(
          (o) => o.title !== stackTitle,
        )
        ;(groupingFieldColumn.value.colOptions as SelectOptionsType).options = newOptions
        await api.dbTableColumn.update(groupingFieldColumn.value.id!, {
          ...groupingFieldColumn.value,
          colOptions: {
            options: newOptions,
          },
        } as any)

        // update kanban stack meta
        groupingFieldColOptions.value.splice(stackIdx, 1)
        stackMetaObj.value[kanbanMetaData.value.fk_grp_col_id!] = groupingFieldColOptions.value
        await updateKanbanStackMeta()
        $e('a:kanban:delete-stack')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    function addEmptyRow(addAfter = formattedData.value.get(null)!.length) {
      formattedData.value.get(null)!.splice(addAfter, 0, {
        row: {},
        oldRow: {},
        rowMeta: { new: true },
      })
      return formattedData.value.get(null)![addAfter]
    }

    function addOrEditStackRow(row: Row, isNewRow: boolean, rowIndex?: number) {
      const stackTitle = row.row[groupingField.value]
      const oldStackTitle = row.oldRow[groupingField.value]

      if (isNewRow) {
        // add a new record
        if (stackTitle) {
          // push the row to target stack
          if (rowIndex !== undefined) {
            formattedData.value.get(stackTitle)!.splice(rowIndex, 0, row)
          } else {
            formattedData.value.get(stackTitle)!.push(row)
          }
          // increase the current count in the target stack by 1
          countByStack.value.set(stackTitle, countByStack.value.get(stackTitle)! + 1)
          // clear the one under uncategorized since we don't reload the view
          removeRowFromUncategorizedStack()
        } else {
          // data will be still in Uncategorized stack
          // no action is required
        }
      } else {
        // update existing record
        const targetPrimaryKey = extractPkFromRow(row.row, meta!.value!.columns as ColumnType[])
        const idxToUpdateOrDelete = formattedData.value
          .get(oldStackTitle)!
          .findIndex((ele) => extractPkFromRow(ele.row, meta!.value!.columns as ColumnType[]) === targetPrimaryKey)
        if (idxToUpdateOrDelete !== -1) {
          if (stackTitle !== oldStackTitle) {
            // remove old row from countByStack & formattedData
            countByStack.value.set(oldStackTitle, countByStack.value.get(oldStackTitle)! - 1)
            const updatedRow = formattedData.value.get(oldStackTitle)!
            updatedRow.splice(idxToUpdateOrDelete, 1)
            formattedData.value.set(oldStackTitle, updatedRow)

            // add new row to countByStack & formattedData
            countByStack.value.set(stackTitle, countByStack.value.get(stackTitle)! + 1)

            if (rowIndex !== undefined) {
              const targetStack = formattedData.value.get(stackTitle)!
              targetStack.splice(rowIndex, 0, row)
              formattedData.value.set(stackTitle, targetStack)
            } else {
              formattedData.value.set(stackTitle, [...formattedData.value.get(stackTitle)!, row])
            }
          } else {
            // update the row in formattedData
            const updatedRow = formattedData.value.get(stackTitle)!

            if (rowIndex !== undefined) {
              updatedRow.splice(idxToUpdateOrDelete, 1)
              updatedRow.splice(rowIndex, 0, row)
            } else {
              updatedRow[idxToUpdateOrDelete] = row
            }

            formattedData.value.set(oldStackTitle, updatedRow)
          }
        }
      }
    }

    function removeRowFromTargetStack(row: Row) {
      // primary key of Row to be deleted
      const targetPrimaryKey = extractPkFromRow(row.row, meta!.value!.columns as ColumnType[])
      // stack title of Row to be deleted
      const stackTitle = row.row[groupingField.value]
      // remove target row from formattedData
      formattedData.value.set(
        stackTitle,
        formattedData.value
          .get(stackTitle)!
          .filter((ele) => extractPkFromRow(ele.row, meta!.value!.columns as ColumnType[]) !== targetPrimaryKey),
      )
      // decrease countByStack of target stack by 1
      countByStack.value.set(stackTitle, countByStack.value.get(stackTitle)! - 1)
    }

    function removeRowFromUncategorizedStack() {
      // remove the last record
      formattedData.value.get(null)!.pop()
      // decrease total count by 1
      countByStack.value.set(null, countByStack.value.get(null)! - 1)
    }

    async function deleteRow(row: Row, undo = false) {
      try {
        if (!undo) {
          addUndo({
            redo: {
              fn: async function redo(this: UndoRedoAction, r: Row) {
                await deleteRow(r, true)
              },
              args: [clone(row)],
            },
            undo: {
              fn: async function undo(this: UndoRedoAction, row: Row) {
                const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
                row.row = { ...pkData, ...row.row }
                await insertRow(row.row, undefined, true)
                addOrEditStackRow(row, true)
              },
              args: [clone(row)],
            },
            scope: defineViewScope({ view: viewMeta.value as ViewType }),
          })
        }

        if (!row.rowMeta.new) {
          const id = (meta?.value?.columns as ColumnType[])
            ?.filter((c) => c.pk)
            .map((c) => row.row[c.title!])
            .join('___')

          const deleted = await deleteRowById(id as string)
          if (!deleted) {
            return
          }
        }

        // remove deleted row from state
        removeRowFromTargetStack(row)
      } catch (e: any) {
        message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    async function deleteRowById(id: string) {
      if (!id) {
        throw new Error("Delete not allowed for table which doesn't have primary Key")
      }

      const res: any = await $api.dbViewRow.delete(
        'noco',
        base.value.id as string,
        meta.value?.id as string,
        viewMeta.value?.id as string,
        encodeURIComponent(id),
      )

      if (res.message) {
        message.info(
          `Record delete failed: ${`Unable to delete record with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
        )
        return false
      }
      return true
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
      addOrEditStackRow,
      deleteStack,
      updateKanbanStackMeta,
      removeRowFromUncategorizedStack,
      shouldScrollToRight,
      deleteRow,
      moveHistory,
    }
  },
  'kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStoreOrThrow() {
  const kanbanViewStore = useKanbanViewStore()

  if (kanbanViewStore == null) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')

  return kanbanViewStore
}
