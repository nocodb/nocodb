import type { AuditType, ColumnType, CommentType, TableType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import dayjs from 'dayjs'

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState((meta: Ref<TableType>, _row: Ref<Row>) => {
  const { $e, $state, $api } = useNuxtApp()

  const { t } = useI18n()

  const isPublic = inject(IsPublicInj, ref(false))

  const comments = ref<
    Array<
      CommentType & {
        created_display_name: string
        resolved_display_name?: string
      }
    >
  >([])

  const audits = ref<Array<AuditType>>([])

  const isCommentsLoading = ref(false)

  const isAuditLoading = ref(false)

  const commentsDrawer = ref(true)

  const saveRowAndStay = ref(0)

  const changedColumns = ref(new Set<string>())

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

  const { base } = storeToRefs(useBase())

  const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

  const { sharedView } = useSharedView()

  const row = ref<Row>(
    !sharedView.value ||
      sharedView.value?.type === ViewTypes.GALLERY ||
      sharedView.value?.type === ViewTypes.KANBAN ||
      _row.value?.rowMeta?.new
      ? _row.value
      : ({ row: {}, oldRow: {}, rowMeta: {} } as Row),
  )

  if (row.value?.rowMeta?.fromExpandedForm) {
    row.value.rowMeta.fromExpandedForm = true
  }
  const rowStore = useProvideSmartsheetRowStore(row)

  const activeView = inject(ActiveViewInj, ref())

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

  const { isUIAllowed } = useRoles()

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

  const loadComments = async (_rowId?: string) => {
    if (!isUIAllowed('commentList') || (!row.value && !_rowId)) return

    const rowId = _rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

    if (!rowId) return

    try {
      isCommentsLoading.value = true

      const res = ((
        await $api.utils.commentList({
          row_id: rowId,
          fk_model_id: meta.value.id as string,
        })
      ).list || []) as Array<
        CommentType & {
          created_display_name: string
        }
      >

      comments.value = res.map((comment) => {
        const user = baseUsers.value.find((u) => u.id === comment.created_by)
        const resolvedUser = comment.resolved_by ? baseUsers.value.find((u) => u.id === comment.resolved_by) : null
        return {
          ...comment,
          created_display_name: user?.display_name ?? (user?.email ?? '').split('@')[0],
          resolved_display_name: resolvedUser ? resolvedUser.display_name ?? resolvedUser.email.split('@')[0] : null,
        }
      })
    } catch (e: unknown) {
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    } finally {
      isCommentsLoading.value = false
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!isUIAllowed('commentDelete')) return
    const tempC = comments.value.find((c) => c.id === commentId)

    try {
      comments.value = comments.value.filter((c) => c.id !== commentId)

      await $api.utils.commentDelete(commentId)

      // update comment count in rowMeta
      Object.assign(row.value, {
        ...row.value,
        rowMeta: {
          ...row.value.rowMeta,
          commentCount: (row.value.rowMeta.commentCount ?? 1) - 1,
        },
      })
    } catch (e: unknown) {
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
      comments.value = [...comments.value, tempC]
    }
  }

  const loadAudits = async (_rowId?: string, showLoading: boolean = true) => {
    if (!isUIAllowed('auditListRow') || isEeUI || (!row.value && !_rowId)) return

    const rowId = _rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

    if (!rowId) return

    try {
      if (showLoading) {
        isAuditLoading.value = true
      }
      const res =
        (
          await $api.utils.auditList({
            row_id: rowId,
            fk_model_id: meta.value.id as string,
          })
        ).list?.reverse?.() || []

      audits.value = res.map((audit) => {
        const user = baseUsers.value.find((u) => u.email === audit.user)
        return {
          ...audit,
          created_display_name: user?.display_name ?? (user?.email ?? '').split('@')[0],
          created_by_email: user?.email,
        }
      })
    } catch (e: any) {
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    } finally {
      isAuditLoading.value = false
    }
  }

  const isYou = (email: string) => {
    return $state.user?.value?.email === email
  }

  const loadKanbanData = async () => {
    if (activeView.value?.type === ViewTypes.KANBAN) {
      const { loadKanbanData: _loadKanbanData } = useKanbanViewStoreOrThrow()
      await _loadKanbanData()
    }
  }

  const resolveComment = async (commentId: string) => {
    if (!isUIAllowed('commentResolve')) return
    const tempC = comments.value.find((c) => c.id === commentId)

    try {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            resolved_by: tempC.resolved_by ? null : $state.user?.value?.id,
            resolved_by_email: tempC.resolved_by ? null : $state.user?.value?.email,
            resolved_display_name: tempC.resolved_by
              ? null
              : $state.user?.value?.display_name ?? $state.user?.value?.email.split('@')[0],
          }
        }
        return c
      })
      await $api.utils.commentResolve(commentId)
    } catch (e: unknown) {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return tempC
        }
        return c
      })
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  const saveComment = async (comment: string) => {
    try {
      if (!row.value || !comment) {
        comments.value = comments.value.filter((c) => !c.id?.startsWith('temp-'))
        return
      }

      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      if (!rowId) return

      await $api.utils.commentRow({
        fk_model_id: meta.value?.id as string,
        row_id: rowId,
        comment: `${comment}`.replace(/(<br \/>)+$/g, ''),
      })

      // Increase Comment Count in rowMeta
      Object.assign(row.value, {
        rowMeta: {
          ...row.value.rowMeta,
          commentCount: (row.value.rowMeta.commentCount ?? 0) + 1,
        },
      })

      // reloadTrigger?.trigger()

      await loadComments()
    } catch (e: any) {
      comments.value = comments.value.filter((c) => !(c.id ?? '').startsWith('temp-'))
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }

    $e('a:row-expand:comment')
  }

  const save = async (
    ltarState: Record<string, any> = {},
    undo = false,
    // TODO: Hack. Remove this when kanban injection store issue is resolved
    {
      kanbanClbk,
    }: {
      kanbanClbk?: (row: Row, isNewRow: boolean) => void
    } = {},
  ) => {
    if (!meta.value.id) return

    let data

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

      data = await $api.dbTableRow.create('noco', base.value.id as string, meta.value.id, {
        ...insertObj,
        ...(ltarState || {}),
      })

      Object.assign(row.value, {
        row: data,
        rowMeta: {
          ...row.value.rowMeta,
          new: false,
        },
        oldRow: { ...data },
      })

      if (!undo) {
        const id = extractPkFromRow(data, meta.value?.columns as ColumnType[])
        const pkData = rowPkData(row.value.row, meta.value?.columns as ColumnType[])

        // TODO remove linked record
        addUndo({
          redo: {
            fn: async (rowData: any) => {
              await $api.dbTableRow.create('noco', base.value.id as string, meta.value.id, { ...pkData, ...rowData })
              await loadKanbanData()
              reloadTrigger?.trigger()
            },
            args: [clone(insertObj)],
          },
          undo: {
            fn: async (id: string) => {
              const res: any = await $api.dbViewRow.delete(
                'noco',
                base.value.id as string,
                meta.value?.id as string,
                activeView.value?.id as string,
                encodeURIComponent(id),
              )
              if (res.message) {
                throw new Error(res.message)
              }

              await loadKanbanData()
              reloadTrigger?.trigger()
            },
            args: [id],
          },
          scope: defineViewScope({ view: activeView.value }),
        })
      }
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

        await $api.dbTableRow.update(NOCO, base.value.id as string, meta.value.id, encodeURIComponent(id), updateOrInsertObj)

        if (!undo) {
          const undoObject = [...changedColumns.value].reduce((obj, col) => {
            obj[col] = row.value.oldRow[col]
            return obj
          }, {} as Record<string, any>)

          addUndo({
            redo: {
              fn: async (id: string, data: Record<string, any>) => {
                await $api.dbTableRow.update(NOCO, base.value.id as string, meta.value.id!, encodeURIComponent(id), data)
                await loadKanbanData()

                reloadTrigger?.trigger()
              },
              args: [id, clone(updateOrInsertObj)],
            },
            undo: {
              fn: async (id: string, data: Record<string, any>) => {
                await $api.dbTableRow.update(NOCO, base.value.id as string, meta.value.id!, encodeURIComponent(id), data)
                await loadKanbanData()
                reloadTrigger?.trigger()
              },
              args: [id, clone(undoObject)],
            },
            scope: defineViewScope({ view: activeView.value }),
          })
        }

        if (commentsDrawer.value) {
          await Promise.all([loadComments(), loadAudits()])
        }
      } else {
        // No columns to update
        message.info(t('msg.info.noColumnsToUpdate'))
        return
      }
    }

    if (activeView.value?.type === ViewTypes.KANBAN && kanbanClbk) {
      kanbanClbk(row.value, isNewRow)
    }

    changedColumns.value = new Set()
    $e('a:row-expand:add')
    return data
  }

  const clearColumns = () => {
    changedColumns.value = new Set()
  }

  const loadRow = async (rowId?: string, onlyVirtual = false, onlyNewColumns = false) => {
    if (row?.value?.rowMeta?.new || isPublic.value || !meta.value?.id) return

    const recordId = rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

    if (!recordId) return
    let record: Record<string, any> = {}
    try {
      record = await $api.dbTableRow.read(
        NOCO,
        // todo: base_id missing on view type
        ((base?.value?.id ?? meta.value?.base_id) || (sharedView.value?.view as any)?.base_id) as string,
        meta.value.id as string,
        encodeURIComponent(recordId),
        {
          getHiddenColumn: true,
        },
      )
    } catch (err: any) {
      if (err.response?.status === 404) {
        const router = useRouter()
        message.error(t('msg.noRecordFound'))
        router.replace({ query: {} })
      } else {
        message.error(`${await extractSdkResponseErrorMsg(err)}`)
      }
    }

    try {
      // update only virtual columns value if `onlyVirtual` is true
      if (onlyVirtual) {
        record = {
          ...row.value.row,
          ...(meta.value.columns ?? []).reduce((partialRecord, col) => {
            if (isVirtualCol(col) && col.title && col.title in record) {
              partialRecord[col.title] = (record as Record<string, any>)[col.title as string]
            }
            return partialRecord
          }, {} as Record<string, any>),
        }
      }

      // update only new/duplicated/renamed columns value if `onlyNewColumns` is true
      if (onlyNewColumns) {
        record = Object.keys(record).reduce((acc, curr) => {
          if (!Object.prototype.hasOwnProperty.call(row.value.row, curr)) {
            acc[curr] = record[curr]
          } else {
            acc[curr] = row.value.row[curr]
          }
          return acc
        }, {} as Record<string, any>)
      }

      Object.assign(row.value, {
        row: record,
        oldRow: { ...record },
        rowMeta: {
          ...row.value.rowMeta,
        },
      })
    } catch (e: any) {
      message.error(`${t('msg.error.errorLoadingRecord')}`)
    }
  }

  const deleteRowById = async (rowId?: string) => {
    try {
      const recordId = rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      const res: { message?: string[] } | number = await $api.dbTableRow.delete(
        NOCO,
        base.value.id as string,
        meta.value.id as string,
        encodeURIComponent(recordId),
      )

      if (res.message) {
        message.info(
          `Record delete failed: ${`Unable to delete record with ID ${rowId} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
        )
        return false
      }
    } catch (e: any) {
      message.error(`${t('msg.error.deleteFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  const updateComment = async (commentId: string, comment: Partial<CommentType>) => {
    const tempEdit = comments.value.find((c) => c.id === commentId)
    try {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            ...comment,
            updated_at: new Date().toISOString(),
          }
        }
        return c
      })
      await $api.utils.commentUpdate(commentId, comment)
    } catch (e: any) {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return tempEdit
        }
        return c
      })
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  return {
    ...rowStore,
    loadComments,
    deleteComment,
    loadAudits,
    comments,
    audits,
    isAuditLoading,
    resolveComment,
    isCommentsLoading,
    saveComment,
    isYou,
    commentsDrawer,
    row,
    deleteRowById,
    displayValue,
    save,
    changedColumns,
    loadRow,
    primaryKey,
    saveRowAndStay,
    updateComment,
    clearColumns,
  }
}, 'expanded-form-store')

export { useProvideExpandedFormStore }

export function useExpandedFormStoreOrThrow() {
  const expandedFormStore = useExpandedFormStore()

  if (expandedFormStore == null) throw new Error('Please call `useExpandedFormStore` on the appropriate parent component')

  return expandedFormStore
}
