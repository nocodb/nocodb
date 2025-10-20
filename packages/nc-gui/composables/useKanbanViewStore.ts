import type { ComputedRef, Ref } from 'vue'
import { EventType, ViewTypes } from 'nocodb-sdk'
import type {
  Api,
  ColumnType,
  type DataPayload,
  KanbanType,
  SelectOptionType,
  SelectOptionsType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'

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

    const addNewStackId = 'addNewStack'

    const uncategorizedStackId = 'uncategorized'

    const { t } = useI18n()

    const { api } = useApi()

    const baseStore = useBase()

    const { base } = storeToRefs(baseStore)

    const { getBaseType } = baseStore

    const { $e, $api, $ncSocket } = useNuxtApp()

    const { sorts, nestedFilters, eventBus, xWhere, allFilters, validFiltersFromUrlParams } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData, fetchSharedViewGroupedData } = useSharedView()

    const { isUIAllowed } = useRoles()

    /**
     * In shared view mode, `isPublic` will still be false because both
     * `useProvideSmartsheetStore` and `provide(IsPublicInj)` are called at the same
     * component level, so the inject doesn't see the provided value.
     */
    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    const password = ref<string | null>(null)

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const viewStore = useViewsStore()

    const { updateViewMeta } = viewStore

    const { setMeta, metas } = useMetas()

    const { user } = useGlobal()

    // save history of stack changes for undo/redo
    const moveHistory = ref<{ op: 'added' | 'removed'; pk: string; stack: string; index: number }[]>([])

    provide(SharedViewPasswordInj, password)

    // kanban view meta data
    const kanbanMetaData = computed(() => {
      if (isPublic.value) {
        return sharedView.value?.view as KanbanType
      } else {
        return viewMeta.value?.view
      }
    })

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

    const groupingFieldColumn = computed(() => {
      if (!meta.value?.columns || !kanbanMetaData.value?.fk_grp_col_id) return undefined

      if (isPublic.value) {
        return parseProp(sharedView.value?.meta).groupingFieldColumn as ColumnType
      } else {
        return (meta.value.columns as ColumnType[]).find((f) => f.id === kanbanMetaData.value.fk_grp_col_id)
      }
    })

    const groupingField = computed(() => groupingFieldColumn.value?.title ?? '')

    // stack meta in object format
    const stackMetaObj = computed(() => parseProp(kanbanMetaData.value?.meta) || {})

    // grouping field column options - e.g. title, fk_column_id, color etc
    const groupingFieldColOptions = computed(() => {
      if (!groupingFieldColumn.value?.id) return []

      const columnId = groupingFieldColumn.value.id
      const columnOptions = (groupingFieldColumn.value.colOptions as SelectOptionsType)?.options ?? []

      // Check if we have valid stack meta
      const stackMeta = stackMetaObj.value[columnId]

      if (!Array.isArray(stackMeta) || stackMeta.length === 0) {
        // Missing or invalid stack meta - rebuild locally
        const rebuiltOptions: GroupingFieldColOptionsType[] = []

        // Add uncategorized stack first
        rebuiltOptions.push({
          id: uncategorizedStackId,
          title: null,
          order: 0,
          color: '#6A7184',
          collapsed: false,
        })

        // Add column options
        columnOptions.forEach((option, index) => {
          rebuiltOptions.push({
            ...option,
            order: index + 1,
            collapsed: false,
          })
        })

        // Try to persist if user has permissions (fire and forget)
        if (!isPublic.value && isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true })) {
          nextTick(() => {
            updateKanbanMeta({
              meta: {
                ...stackMetaObj.value,
                [columnId]: rebuiltOptions,
              },
            }).catch(() => {
              // Silently fail - continue with local rebuild
            })
          })
        }

        return rebuiltOptions.sort((a, b) => (a.order || 0) - (b.order || 0))
      }

      // Valid stack meta exists - sync with column options
      const syncedOptions = [...stackMeta]
      let needsSync = false

      // Update existing options with latest column data
      for (const option of columnOptions) {
        const idx = syncedOptions.findIndex((stack) => stack.id === option.id)
        if (idx !== -1) {
          // Check if select option properties changed
          const existing = syncedOptions[idx]
          if (existing.title !== option.title || existing.color !== option.color) {
            syncedOptions[idx] = {
              ...existing,
              title: option.title,
              color: option.color,
            }
            needsSync = true
          }
        } else {
          // New option - add with proper order
          const maxOrder = Math.max(...syncedOptions.map((s) => s.order || 0), 0)
          syncedOptions.push({
            ...option,
            order: maxOrder + 1,
            collapsed: false,
          })
          needsSync = true
        }
      }

      // Remove deleted options (except uncategorized)
      const columnOptionIds = columnOptions.map((opt) => opt.id)
      const filteredOptions = syncedOptions.filter(
        (stack) => stack.id === uncategorizedStackId || columnOptionIds.includes(stack.id),
      )

      if (filteredOptions.length !== syncedOptions.length) {
        needsSync = true
      }

      // Persist changes if needed and allowed
      if (needsSync && !isPublic.value && isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true })) {
        nextTick(() => {
          updateKanbanMeta({
            meta: {
              ...stackMetaObj.value,
              [columnId]: filteredOptions,
            },
          }).catch(() => {
            // Silently fail
          })
        })
      }

      return filteredOptions.sort((a, b) => (a.order || 0) - (b.order || 0))
    })

    const shouldScrollToRight = ref(false)

    const formatData = (
      list: Record<string, any>[],
      evaluateRowMetaRowColorInfoCallback?: (row: Record<string, any>) => RowMetaRowColorInfo,
    ) =>
      list.map((row) => ({
        row: { ...row },
        oldRow: { ...row },
        rowMeta: {
          ...(evaluateRowMetaRowColorInfoCallback?.(row) ?? {}),
        },
      }))

    async function loadKanbanData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta?.value?.id || !groupingFieldColumn?.value?.id) && !isPublic.value)
        return

      const newFormattedData = new Map<string | null, Row[]>()
      const newCountByStack = new Map<string | null, number>()

      let groupData

      if (isPublic.value) {
        groupData = await fetchSharedViewGroupedData(groupingFieldColumn!.value!.id!, {
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
          include_row_color: true,
          where: xWhere.value,
        })
      } else {
        groupData = await api.dbViewRow.groupedDataList(
          'noco',
          base.value.id!,
          meta.value!.id!,
          viewMeta.value!.id!,
          groupingFieldColumn!.value!.id!,
          { where: xWhere.value, include_row_color: true },
          {},
        )
      }

      for (const data of groupData ?? []) {
        const key = typeof data.key === 'string' ? (data.key?.length ? data.key : null) : null
        newFormattedData.set(key, formatData(data.value.list, getEvaluatedRowMetaRowColorInfo))
        newCountByStack.set(key, data.value.pageInfo.totalRows || 0)
      }

      formattedData.value = newFormattedData
      countByStack.value = newCountByStack
    }

    const filerDuplicateRecords = (existingRecords: Row[], newRecords: Row[]) => {
      const existingRecordsMap = (existingRecords || []).reduce((acc, curr) => {
        const primaryKey = extractPkFromRow(curr.row, meta!.value!.columns as ColumnType[])
        if (primaryKey) {
          acc[primaryKey] = curr
        }
        return acc
      }, {} as Record<string, Row>)

      return (newRecords || []).filter(({ row }) => {
        const primaryKey = extractPkFromRow(row, meta!.value!.columns as ColumnType[])
        if (primaryKey && existingRecordsMap[primaryKey]) {
          return false
        }
        return true
      })
    }

    async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return
      let where = `(${groupingField.value},eq,${stackTitle})`
      if (stackTitle === null) {
        where = `(${groupingField.value},is,blank)`
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

      formattedData.value.set(stackTitle, [
        ...formattedData.value.get(stackTitle)!,
        ...filerDuplicateRecords(
          formattedData.value.get(stackTitle)!,
          formatData(response!.list!, getEvaluatedRowMetaRowColorInfo),
        ),
      ])
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id) return
      await updateViewMeta(viewMeta.value.id, ViewTypes.KANBAN, updateObj, {
        skipNetworkCall: isPublic.value || !isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true }),
      })
    }

    const updateStackProperty = async (stackIdx: number, updates: Partial<GroupingFieldColOptionsType>) => {
      const stackMeta = [...groupingFieldColOptions.value]
      stackMeta[stackIdx] = { ...stackMeta[stackIdx], ...updates }

      const updatedStackMetaObj = {
        ...stackMetaObj.value,
        [kanbanMetaData.value.fk_grp_col_id!]: stackMeta,
      }

      await updateKanbanMeta({
        meta: updatedStackMetaObj,
      })
    }

    const updateAllStacksProperty = async (
      updates: (stack: GroupingFieldColOptionsType, index: number) => Partial<GroupingFieldColOptionsType> | null,
    ) => {
      const stackMeta = groupingFieldColOptions.value.map((stack, index) => {
        const stackUpdates = updates(stack, index)
        return stackUpdates ? { ...stack, ...stackUpdates } : stack
      })

      const updatedStackMetaObj = {
        ...stackMetaObj.value,
        [kanbanMetaData.value.fk_grp_col_id!]: stackMeta,
      }

      await updateKanbanMeta({
        meta: updatedStackMetaObj,
      })
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
          metaValue?.base_id ?? (base?.value.id as string),
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
                Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
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
          rowMeta: {
            ...getEvaluatedRowMetaRowColorInfo(insertedData),
          },
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
          meta.value?.base_id ?? (base?.value.id as string),
          meta.value?.id as string,
          viewMeta?.value?.id as string,
          encodeURIComponent(id),
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
                  Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(updatedData))

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
                  Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(updatedData))

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
          Object.assign(toUpdate.rowMeta, getEvaluatedRowMetaRowColorInfo(updatedRowData))
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
            (formattedData.value.get(stackTitle) || []).map((o) => ({
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
        const cdf = groupingFieldColumn.value.cdf ? groupingFieldColumn.value.cdf.replace(/^'/, '').replace(/'$/, '') : null
        const newMeta = await api.dbTableColumn.update(groupingFieldColumn.value.id!, {
          ...groupingFieldColumn.value,
          colOptions: {
            options: newOptions,
          },
          cdf: cdf === stackTitle ? null : cdf,
        } as any)
        await setMeta(newMeta)

        const splicedOps = [...groupingFieldColOptions.value].splice(stackIdx, 1)
        // update kanban stack meta
        await updateKanbanMeta({
          meta: {
            ...stackMetaObj.value,
            [kanbanMetaData.value.fk_grp_col_id!]: splicedOps,
          },
        })

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

      // if the update happen on linked table, do not attempt to update stack
      if (!stackTitle || oldStackTitle) {
        return
      }
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
      if (isPublic.value) return
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
          const id = extractPkFromRow(row.row, meta?.value?.columns)

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
        meta.value?.base_id ?? (base.value.id as string),
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

    /**
     * This is used to update the rowMeta color info when the row colour info is updated
     */
    const smartsheetStoreEventHandler = (event: SmartsheetStoreEvents) => {
      if (![SmartsheetStoreEvents.TRIGGER_RE_RENDER, SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE].includes(event)) {
        return
      }

      const groupKeys = Array.from(formattedData.value.keys())

      groupKeys.forEach((key) => {
        const formattedDataCopy = formattedData.value.get(key) ?? []

        if (!formattedDataCopy.length) return

        formattedDataCopy.forEach((row) => {
          Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
        })

        formattedData.value.set(key, formattedDataCopy)
      })
    }

    eventBus.on(smartsheetStoreEventHandler)

    watch([groupingFieldColumn], () => {
      loadKanbanData()
    })

    const activeDataListener = ref<string | null>(null)

    const handleDataEvent = (data: DataPayload) => {
      const { id, action, payload, before } = data

      // TODO: @mertmit handle filters and sort for newly added and updated records
      if (action === 'add') {
        try {
          const isValidationFailed = !validateRowFilters(
            [...allFilters.value, ...validFiltersFromUrlParams.value],
            payload,
            meta.value?.columns as ColumnType[],
            getBaseType(viewMeta.value?.view?.source_id),
            metas.value,
            {
              currentUser: user.value,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          )

          if (isValidationFailed) {
            return
          }

          const stackKey =
            typeof payload[groupingField.value] === 'string'
              ? payload[groupingField.value]?.length
                ? payload[groupingField.value]
                : null
              : null

          const newRow: Row = {
            row: payload,
            oldRow: { ...payload },
            rowMeta: { new: false, ...getEvaluatedRowMetaRowColorInfo(payload) },
          }

          if (!formattedData.value.has(stackKey)) {
            formattedData.value.set(stackKey, [])
            countByStack.value.set(stackKey, 0)
          }

          const stackRows = formattedData.value.get(stackKey)!

          if (before) {
            const beforeIndex = stackRows.findIndex((row) => {
              const pk = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
              return pk && `${pk}` === `${before}`
            })
            if (beforeIndex !== -1) {
              stackRows.splice(beforeIndex, 0, newRow)
            } else {
              stackRows.push(newRow)
            }
          } else {
            stackRows.push(newRow)
          }

          countByStack.value.set(stackKey, (countByStack.value.get(stackKey) || 0) + 1)
          formattedData.value.set(stackKey, [...stackRows])
        } catch (e) {
          console.error('Failed to add row to kanban on socket event', e)
        }
      } else if (action === 'update') {
        try {
          const isValidationFailed = !validateRowFilters(
            [...allFilters.value, ...validFiltersFromUrlParams.value],
            payload,
            meta.value?.columns as ColumnType[],
            getBaseType(viewMeta.value?.view?.source_id),
            metas.value,
            {
              currentUser: user.value,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          )

          if (isValidationFailed) {
            handleDataEvent({ ...data, action: 'delete' })
            return
          }

          let found = null
          let foundStackKey = null
          let foundIndex = -1

          // Find the row across all stacks
          for (const [stackKey, rows] of formattedData.value.entries()) {
            const index = rows.findIndex((row) => {
              const pk = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
              return pk && `${pk}` === `${id}`
            })
            if (index !== -1) {
              found = rows[index]
              foundStackKey = stackKey
              foundIndex = index
              break
            }
          }

          if (!found) {
            handleDataEvent({ ...data, action: 'add' })
            return
          }

          const oldStackKey = foundStackKey
          const newStackKey =
            typeof payload[groupingField.value] === 'string'
              ? payload[groupingField.value]?.length
                ? payload[groupingField.value]
                : null
              : null

          // Update row data
          Object.assign(found.row, payload)
          Object.assign(found.oldRow, payload)
          Object.assign(found.rowMeta, getEvaluatedRowMetaRowColorInfo(payload))
          found.rowMeta.changed = false

          // Handle stack change
          if (oldStackKey !== newStackKey) {
            // Remove from old stack
            const oldStackRows = formattedData.value.get(oldStackKey)!
            oldStackRows.splice(foundIndex, 1)
            formattedData.value.set(oldStackKey, [...oldStackRows])
            countByStack.value.set(oldStackKey, (countByStack.value.get(oldStackKey) || 0) - 1)

            // Add to new stack
            if (!formattedData.value.has(newStackKey)) {
              formattedData.value.set(newStackKey, [])
              countByStack.value.set(newStackKey, 0)
            }

            const newStackRows = formattedData.value.get(newStackKey)!
            newStackRows.push(found)
            formattedData.value.set(newStackKey, [...newStackRows])
            countByStack.value.set(newStackKey, (countByStack.value.get(newStackKey) || 0) + 1)
          } else {
            // Row stays in same stack
            const stackRows = formattedData.value.get(foundStackKey)!
            stackRows[foundIndex] = found
            formattedData.value.set(foundStackKey, [...stackRows])
          }
        } catch (e) {
          console.error('Failed to update row in kanban on socket event', e)
        }
      } else if (action === 'delete') {
        try {
          for (const [stackKey, rows] of formattedData.value.entries()) {
            const index = rows.findIndex((row) => {
              const pk = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
              return pk && `${pk}` === `${id}`
            })
            if (index !== -1) {
              const stackRows = formattedData.value.get(stackKey)!
              stackRows.splice(index, 1)
              formattedData.value.set(stackKey, [...stackRows])
              countByStack.value.set(stackKey, Math.max((countByStack.value.get(stackKey) || 0) - 1, 0))
              break
            }
          }
        } catch (e) {
          console.error('Failed to delete row from kanban on socket event', e)
        }
      }
    }

    watch(
      meta,
      (newMeta, oldMeta) => {
        if (newMeta?.fk_workspace_id && newMeta?.base_id && newMeta?.id) {
          if (oldMeta?.id && oldMeta.id === newMeta.id) return

          // Clean up existing listeners
          if (activeDataListener.value) {
            $ncSocket.offMessage(activeDataListener.value)
          }

          // Set up data event listener
          activeDataListener.value = $ncSocket.onMessage(
            `${EventType.DATA_EVENT}:${newMeta.fk_workspace_id}:${newMeta.base_id}:${newMeta.id}`,
            handleDataEvent,
          )
        }
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      eventBus.off(smartsheetStoreEventHandler)

      if (activeDataListener.value) {
        $ncSocket.offMessage(activeDataListener.value)
      }
    })

    return {
      loadKanbanData,
      loadMoreKanbanData,
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
      removeRowFromUncategorizedStack,
      shouldScrollToRight,
      deleteRow,
      stackMetaObj,
      moveHistory,
      addNewStackId,
      updateStackProperty,
      updateAllStacksProperty,
      uncategorizedStackId,
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
