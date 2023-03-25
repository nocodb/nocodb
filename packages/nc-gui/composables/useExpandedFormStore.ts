import { UITypes, ViewTypes } from 'nocodb-sdk'
import type { AuditType, ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import dayjs from 'dayjs'
import {
  NOCO,
  computed,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  getHTMLEncodedText,
  message,
  populateInsertObject,
  ref,
  storeToRefs,
  useApi,
  useI18n,
  useInjectionState,
  useKanbanViewStoreOrThrow,
  useMetas,
  useNuxtApp,
  useProject,
  useProvideSmartsheetRowStore,
  useSharedView,
  useUndoRedo,
} from '#imports'
import type { Row, UndoRedoAction } from '~/lib'

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  const { $e, $state, $api } = useNuxtApp()

  const { api, isLoading: isCommentsLoading, error: commentsError } = useApi()

  const { t } = useI18n()

  const commentsOnly = ref(true)

  const commentsAndLogs = ref<any[]>([])

  const comment = ref('')

  const commentsDrawer = ref(true)

  const saveRowAndStay = ref(0)

  const changedColumns = ref(new Set<string>())

  const { project } = storeToRefs(useProject())

  const rowStore = useProvideSmartsheetRowStore(meta, row)

  const activeView = inject(ActiveViewInj, ref())

  const { sharedView } = useSharedView()

  const { addUndo, clone } = useUndoRedo()

  const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

  // getters
  const displayValue = computed(() => {
    if (row?.value?.row) {
      const col = meta?.value?.columns?.find((c) => c.pv)

      if (!col) {
        return
      }

      const value = row.value.row?.[col.title as string]

      const uidt = col.uidt

      if (uidt === UITypes.Date) {
        return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD')
      } else if (uidt === UITypes.DateTime) {
        return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD HH:mm')
      } else if (uidt === UITypes.Time) {
        let dateTime = dayjs(value)
        if (!dateTime.isValid()) {
          dateTime = dayjs(value, 'HH:mm:ss')
        }
        if (!dateTime.isValid()) {
          dateTime = dayjs(`1999-01-01 ${value}`)
        }
        if (!dateTime.isValid()) {
          return value
        }
        return dateTime.format('HH:mm:ss')
      }
      return value
    }
  })

  const primaryKey = computed(() => {
    return extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
  })

  // actions
  const loadCommentsAndLogs = async () => {
    if (!row.value) return

    const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

    if (!rowId) return

    commentsAndLogs.value =
      (
        await api.utils.commentList({
          row_id: rowId,
          fk_model_id: meta.value.id as string,
          comments_only: commentsOnly.value,
        })
      ).list?.reverse?.() || []
  }

  const isYou = (email: string) => {
    return $state.user?.value?.email === email
  }

  const saveComment = async () => {
    try {
      if (!row.value || !comment.value) return

      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      if (!rowId) return

      await api.utils.commentRow({
        fk_model_id: meta.value?.id as string,
        row_id: rowId,
        description: comment.value,
      })

      comment.value = ''

      await loadCommentsAndLogs()
    } catch (e: any) {
      message.error(e.message)
    }

    $e('a:row-expand:comment')
  }

  const save = async (ltarState: Record<string, any> = {}, undo = false) => {
    let data
    try {
      const isNewRow = row.value.rowMeta?.new ?? false

      if (isNewRow) {
        const { getMeta } = useMetas()

        const { missingRequiredColumns, insertObj } = await populateInsertObject({
          meta: meta.value,
          ltarState,
          getMeta,
          row: row.value.row,
          throwError: true,
        })

        if (missingRequiredColumns.size) return

        data = await $api.dbTableRow.create('noco', project.value.title as string, meta.value.title, insertObj)

        if (!undo) {
          const id = extractPkFromRow(data, meta.value?.columns as ColumnType[])

          // TODO remove linked record
          addUndo({
            redo: {
              fn: async function redo(this: UndoRedoAction, row: Row) {
                const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
                row.row = { ...pkData, ...row.row }
                await $api.dbTableRow.create('noco', project.value.title as string, meta.value.title, row.row)
                if (activeView.value?.type === ViewTypes.KANBAN) {
                  const { loadKanbanData } = useKanbanViewStoreOrThrow()
                  await loadKanbanData()
                }
                reloadTrigger?.trigger()
              },
              args: [clone(row.value)],
            },
            undo: {
              fn: async function undo(this: UndoRedoAction, id: string) {
                const res: any = await $api.dbViewRow.delete(
                  'noco',
                  project.value.id as string,
                  meta.value?.id as string,
                  activeView.value?.id as string,
                  id,
                )
                if (res.message) {
                  throw new Error(res.message)
                }
                if (activeView.value?.type === ViewTypes.KANBAN) {
                  const { loadKanbanData } = useKanbanViewStoreOrThrow()
                  await loadKanbanData()
                }
                reloadTrigger?.trigger()
              },
              args: [id],
            },
            scope: activeView.value?.title,
          })
        }

        Object.assign(row.value, {
          row: data,
          rowMeta: {},
          oldRow: { ...data },
        })
      } else {
        const updateOrInsertObj = [...changedColumns.value].reduce((obj, col) => {
          obj[col] = row.value.row[col]
          return obj
        }, {} as Record<string, any>)
        if (Object.keys(updateOrInsertObj).length) {
          const id = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

          if (!id) {
            return message.info("Update not allowed for table which doesn't have primary Key")
          }

          await $api.dbTableRow.update(NOCO, project.value.title as string, meta.value.title, id, updateOrInsertObj)

          if (!undo) {
            const undoObject = [...changedColumns.value].reduce((obj, col) => {
              obj[col] = row.value.oldRow[col]
              return obj
            }, {} as Record<string, any>)

            addUndo({
              redo: {
                fn: async (id: string, data: Record<string, any>) => {
                  await $api.dbTableRow.update(NOCO, project.value.title as string, meta.value.title, id, data)
                  if (activeView.value?.type === ViewTypes.KANBAN) {
                    const { loadKanbanData } = useKanbanViewStoreOrThrow()
                    await loadKanbanData()
                  }
                  reloadTrigger?.trigger()
                },
                args: [id, clone(updateOrInsertObj)],
              },
              undo: {
                fn: async (id: string, data: Record<string, any>) => {
                  await $api.dbTableRow.update(NOCO, project.value.title as string, meta.value.title, id, data)
                  if (activeView.value?.type === ViewTypes.KANBAN) {
                    const { loadKanbanData } = useKanbanViewStoreOrThrow()
                    await loadKanbanData()
                  }
                  reloadTrigger?.trigger()
                },
                args: [id, clone(undoObject)],
              },
              scope: activeView.value?.title,
            })
          }

          for (const key of Object.keys(updateOrInsertObj)) {
            // audit
            $api.utils
              .auditRowUpdate(id, {
                fk_model_id: meta.value.id,
                column_name: key,
                row_id: id,
                value: getHTMLEncodedText(updateOrInsertObj[key]),
                prev_value: getHTMLEncodedText(row.value.oldRow[key]),
              })
              .then(async () => {
                /** load latest comments/audit if right drawer is open */
                if (commentsDrawer.value) {
                  await loadCommentsAndLogs()
                }
              })
          }
        } else {
          // No columns to update
          message.info(t('msg.info.noColumnsToUpdate'))
          return
        }
      }

      if (activeView.value?.type === ViewTypes.KANBAN) {
        const { addOrEditStackRow } = useKanbanViewStoreOrThrow()
        addOrEditStackRow(row.value, isNewRow)
      }

      message.success(`${displayValue.value || 'Row'} updated successfully.`)

      changedColumns.value = new Set()
    } catch (e: any) {
      message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
    $e('a:row-expand:add')
    return data
  }

  const loadRow = async (rowId?: string) => {
    const record = await $api.dbTableRow.read(
      NOCO,
      // todo: project_id missing on view type
      (project?.value?.id || (sharedView.value?.view as any)?.project_id) as string,
      meta.value.title,
      rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[]),
    )

    Object.assign(row.value, {
      row: record,
      oldRow: { ...record },
      rowMeta: {},
    })
  }

  const updateComment = async (auditId: string, audit: Partial<AuditType>) => {
    return await $api.utils.commentUpdate(auditId, audit)
  }

  return {
    ...rowStore,
    commentsOnly,
    loadCommentsAndLogs,
    commentsAndLogs,
    isCommentsLoading,
    commentsError,
    saveComment,
    comment,
    isYou,
    commentsDrawer,
    row,
    displayValue,
    save,
    changedColumns,
    loadRow,
    primaryKey,
    saveRowAndStay,
    updateComment,
  }
}, 'expanded-form-store')

export { useProvideExpandedFormStore }

export function useExpandedFormStoreOrThrow() {
  const expandedFormStore = useExpandedFormStore()

  if (expandedFormStore == null) throw new Error('Please call `useExpandedFormStore` on the appropriate parent component')

  return expandedFormStore
}
