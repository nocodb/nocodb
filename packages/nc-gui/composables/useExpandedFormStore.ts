import type {
  AuditType,
  ColumnType,
  CommentPayload,
  DataPayload,
  MetaType,
  PlanLimitExceededDetailsType,
  TableType,
} from 'nocodb-sdk'
import {
  EventType,
  PermissionEntity,
  PermissionKey,
  PlanLimitTypes,
  ViewTypes,
  isAIPromptCol,
  isHiddenCol,
  isReadOnlyColumn,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'
import type { Ref } from 'vue'
import dayjs from 'dayjs'

interface AuditTypeExtended extends AuditType {
  created_display_name?: string
  created_display_name_short?: string
  created_by_email?: string
  created_by_meta?: MetaType
}

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState(
  (
    meta: Ref<TableType>,
    _row: Ref<Row>,
    maintainDefaultViewOrder: Ref<boolean>,
    useMetaFields: boolean,
    allowNullFieldIds?: string[],
  ) => {
    const { $e, $state, $api, $ncSocket } = useNuxtApp()

    const { t } = useI18n()

    const isPublic = inject(IsPublicInj, ref(false))

    const audits = ref<Array<AuditTypeExtended>>([])

    const isAuditLoading = ref(false)

    const commentsDrawer = ref(true)

    const saveRowAndStay = ref(0)

    const changedColumns = ref<Set<string>>(new Set<string>())

    const localOnlyChanges = ref<Record<string, any>>({})

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
    const rowStore = useProvideSmartsheetRowStore(row, changedColumns)

    const activeView = inject(ActiveViewInj, ref())

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

    const { comments, resolveComment, loadComments, updateComment, deleteComment, saveComment, isCommentsLoading } =
      useProvideRowComments(meta, row)

    const { isUIAllowed } = useRoles()

    const { handleUpgradePlan, isPaymentEnabled } = useEeConfig()

    const { isAllowed } = usePermissions()

    const isAllowedAddNewRecord = computed(() => {
      if (!isEeUI) return true

      return meta.value?.id && isAllowed(PermissionEntity.TABLE, meta.value.id, PermissionKey.TABLE_RECORD_ADD)
    })

    const getIsAllowedEditField = (fieldId: string) => {
      if (!isEeUI) return true

      return fieldId && isAllowed(PermissionEntity.FIELD, fieldId, PermissionKey.RECORD_FIELD_EDIT)
    }

    // getters
    const displayValue = computed(() => {
      if (row?.value?.row) {
        const col = meta?.value?.columns?.find((c) => c.pv)

        if (!col) {
          return
        }

        return row.value.row?.[col.title as string]
      }
    })

    const { fieldsMap, isLocalMode, showSystemFields } = useViewColumnsOrThrow()

    const isHiddenColumnInNewRecord = (col: ColumnType) => {
      return isReadOnlyColumn(col) || isAIPromptCol(col)
    }

    /**
     * Injects the fields from the parent component if available.
     * Uses a ref to ensure reactivity.
     */
    const fieldsFromParent = inject<Ref<ColumnType[] | null>>(FieldsInj, ref(null))

    /**
     * Computes the list of fields to be used based on the given conditions.
     *
     * - Prefers `props.useMetaFields` over `fieldsFromParent` if enabled.
     * - Filters out system columns and readonly fields for new records.
     * - Maintains default view order if `maintainDefaultViewOrder` is enabled.
     *
     * @returns {ColumnType[]} The computed list of fields.
     */
    const fields = computed(() => {
      // Give preference to props.useMetaFields instead of fieldsFromParent
      if (useMetaFields) {
        if (maintainDefaultViewOrder.value) {
          return (meta.value.columns ?? [])
            .filter(
              (col) =>
                !isHiddenCol(col, meta.value ?? {}) &&
                !isSystemColumn(col) &&
                !!(col.meta?.defaultViewColVisibility ?? true) &&
                // if new record, then hide readonly fields
                (!rowStore.isNew.value || !isHiddenColumnInNewRecord(col)),
            )
            .sort((a, b) => {
              return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
            })
        }

        return (meta.value.columns ?? []).filter(
          (col) =>
            !isHiddenCol(col, meta.value ?? {}) &&
            // if new record, then hide readonly fields
            (!rowStore.isNew.value || !isHiddenColumnInNewRecord(col)) &&
            // exclude system columns
            !isSystemColumn(col) &&
            // exclude hidden columns
            !!(col.meta?.defaultViewColVisibility ?? true),
        )
      }

      // If `props.useMetaFields` is not enabled, use fields from the parent component
      if (fieldsFromParent.value) {
        if (rowStore.isNew.value) {
          return fieldsFromParent.value.filter((col) => !isHiddenColumnInNewRecord(col))
        }

        return fieldsFromParent.value
      }

      return []
    })

    const hiddenFields = computed(() => {
      // todo: figure out when meta.value is undefined
      const _hiddenFields = (meta.value?.columns ?? []).filter(
        (col) =>
          !isHiddenCol(col, meta.value ?? {}) &&
          (!useMetaFields || !isSystemColumn(col)) &&
          !fields.value?.includes(col) &&
          (isLocalMode.value && col?.id && fieldsMap.value[col.id] ? fieldsMap.value[col.id]?.initialShow : true) &&
          // exclude readonly fields from hidden fields if new record creation
          (!rowStore.isNew.value || !isHiddenColumnInNewRecord(col)),
      )
      if (useMetaFields) {
        return maintainDefaultViewOrder.value
          ? _hiddenFields.sort((a, b) => {
              return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
            })
          : _hiddenFields
      }
      // record from same view and same table (not linked)
      else {
        return _hiddenFields
          .filter((col) => {
            if (rowStore.isNew.value || !showSystemFields.value) {
              return !isSystemColumn(col)
            }

            return true
          })
          .sort((a, b) => {
            return (fieldsMap.value[a.id]?.order ?? Infinity) - (fieldsMap.value[b.id]?.order ?? Infinity)
          })
      }
    })

    const auditToCursor = (audit: any) => {
      return `${audit.id}|${audit.created_at}`
    }

    const primaryKey = computed(() => {
      return extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
    })

    const currentAuditCursor = ref('')
    const hasMoreAudits = ref(false)

    const loadAudits = async (_rowId?: string, showLoading = true) => {
      if (!isUIAllowed('recordAuditList') || (!row.value && !_rowId)) return

      const rowId = _rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      if (!rowId || !meta.value.base_id) return

      try {
        if (showLoading) {
          isAuditLoading.value = true
        }

        const response = await $api.internal.getOperation(
          base.value.fk_workspace_id ?? NO_SCOPE,
          (meta.value.base_id as string) ?? (base.value.id as string),
          {
            operation: 'recordAuditList',
            fk_model_id: meta.value.id as string,
            row_id: rowId,
            cursor: currentAuditCursor.value,
          },
        )

        // Skip insert as it will be first for all
        response.list = response.list.filter((audit) => !audit?.op_type.includes('INSERT'))

        const lastRecord = response.list?.[response.list.length - 1]

        if (lastRecord) {
          currentAuditCursor.value = auditToCursor(lastRecord)
        }

        hasMoreAudits.value = !response.pageInfo?.isLastPage

        const res = response.list?.reverse?.() || []

        audits.value.unshift(
          ...res.map((audit) => {
            const user = baseUsers.value.find((u) => u.id === audit.fk_user_id || u.email === audit.user)
            return {
              ...audit,
              created_display_name: user?.display_name,
              created_display_name_short: user?.display_name ?? extractNameFromEmail(user?.email),
              created_by_email: user?.email,
              created_by_meta: user?.meta,
            }
          }),
        )
      } catch (e: any) {
        console.error(e)
        const errorInfo = await extractSdkResponseErrorMsgv2(e)

        if (isPaymentEnabled.value && errorInfo.error === NcErrorType.PLAN_LIMIT_EXCEEDED) {
          const details = errorInfo.details as PlanLimitExceededDetailsType

          handleUpgradePlan({
            title: t('upgrade.updateToExtendRecordHistory'),
            content: t('upgrade.updateToExtendRecordHistorySubtitle', {
              activePlan: details.plan,
              plan: details.higherPlan,
              period: formatDurationFromDays(+(details.limit ?? 14)),
            }),
            limitOrFeature: PlanLimitTypes.LIMIT_AUDIT_RETENTION,
          })
        } else {
          message.error(errorInfo.message)
        }
      } finally {
        isAuditLoading.value = false
      }
    }

    function formatDurationFromDays(days: number): string {
      if (days === Infinity) {
        return '3+ years'
      }

      if (days < 14) {
        return `${days} day${days === 1 ? '' : 's'}`
      } else if (days < 30) {
        const weeks = Math.floor(days / 7)
        return `${weeks} week${weeks === 1 ? '' : 's'}`
      } else if (days < 365) {
        const months = Math.floor(days / 30)
        return `${months} month${months === 1 ? '' : 's'}`
      } else {
        const years = Math.floor(days / 365)
        return years > 3 ? `${years}+ years` : `${years} year${years === 1 ? '' : 's'}`
      }
    }

    const loadMoreAudits = async () => {
      if (!hasMoreAudits.value) {
        return
      }
      await loadAudits()
    }

    const resetAuditPages = async () => {
      currentAuditCursor.value = ''
      audits.value = []
      hasMoreAudits.value = false
      await loadAudits()
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
          allowNullFieldIds,
        })

        if (missingRequiredColumns.size) return

        data = await $api.dbTableRow.create('noco', meta.value.base_id, meta.value.id, {
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
                  meta.value?.base_id ?? (base.value.id as string),
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
            return message.info(t('msg.info.updateNotAllowedWithoutPK'))
          }

          await $api.dbTableRow.update(
            NOCO,
            meta.value.base_id ?? (base.value.id as string),
            meta.value.id,
            encodeURIComponent(id),
            updateOrInsertObj,
          )

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
            await Promise.all([loadComments()])
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
          ((meta.value?.base_id ?? base?.value?.id) || (sharedView.value?.view as any)?.base_id) as string,
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
          meta.value?.base_id ?? (base.value.id as string),
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

    const processedAudits = computed(() => {
      const result: typeof audits.value = []

      try {
        const allAudits = JSON.parse(JSON.stringify(audits.value))

        for (const audit of allAudits) {
          if (audit.op_type !== 'DATA_UPDATE') {
            result.push(audit)
            continue
          }

          const details = JSON.parse(audit.details)

          for (const columnKey of Object.keys(details.data || {})) {
            if (!details.column_meta?.[columnKey]) {
              delete details.data[columnKey]
              delete details.old_data[columnKey]
              delete details.column_meta[columnKey]
              continue
            }

            if (
              ['CreatedTime', 'CreatedBy', 'LastModifiedTime', 'LastModifiedBy'].includes(details.column_meta?.[columnKey]?.type)
            ) {
              delete details.data[columnKey]
              delete details.old_data[columnKey]
              delete details.column_meta[columnKey]
              continue
            }
          }

          if (Object.values(details.column_meta || {}).length > 0) {
            audit.details = JSON.stringify(details)
            result.push(audit)
          }
        }
      } catch (e) {
        console.error(e)
      }

      return result
    })

    const consolidatedAudits = computed(() => {
      const result: typeof audits.value = []

      const applyLinkAuditValue = (detail: any, refRowId: string, value: string, type: 'link' | 'unlink') => {
        if (!detail.consolidated_ref_display_values_links) detail.consolidated_ref_display_values_links = []
        if (!detail.consolidated_ref_display_values_unlinks) detail.consolidated_ref_display_values_unlinks = []

        if (type === 'link') {
          if (!detail.consolidated_ref_display_values_unlinks.find((it: any) => it.refRowId === refRowId)) {
            if (!detail.consolidated_ref_display_values_links.find((it: any) => it.refRowId === refRowId)) {
              detail.consolidated_ref_display_values_links.push({ refRowId, value })
            }
          } else {
            detail.consolidated_ref_display_values_unlinks.splice(
              detail.consolidated_ref_display_values_unlinks.findIndex((it: any) => it.refRowId === refRowId),
              1,
            )
          }
        } else {
          if (!detail.consolidated_ref_display_values_links.find((it: any) => it.refRowId === refRowId)) {
            if (!detail.consolidated_ref_display_values_unlinks.find((it: any) => it.refRowId === refRowId)) {
              detail.consolidated_ref_display_values_unlinks.push({ refRowId, value })
            }
          } else {
            detail.consolidated_ref_display_values_links.splice(
              detail.consolidated_ref_display_values_links.findIndex((it: any) => it.refRowId === refRowId),
              1,
            )
          }
        }
      }

      try {
        const allAudits = JSON.parse(JSON.stringify(processedAudits.value))

        while (allAudits.length > 0) {
          const current = allAudits.shift()!
          if (current.op_type === 'DATA_LINK' || current.op_type === 'DATA_UNLINK') {
            const last = result.findLast((it) => it.op_type === 'DATA_LINK' || it.op_type === 'DATA_UNLINK')
            const details = JSON.parse(current.details)
            if (!last) {
              applyLinkAuditValue(
                details,
                details.ref_row_id,
                details.ref_display_value,
                current.op_type === 'DATA_LINK' ? 'link' : 'unlink',
              )
              current.details = JSON.stringify(details)
              result.push(current)
            } else {
              const lastDetails = JSON.parse(last.details)
              if (
                last.user === current.user &&
                dayjs(current.created_at).diff(dayjs(last.created_at), 'second') <= 30 &&
                lastDetails.link_field_id === details.link_field_id &&
                lastDetails.ref_table_title === details.ref_table_title
              ) {
                applyLinkAuditValue(
                  lastDetails,
                  details.ref_row_id,
                  details.ref_display_value,
                  current.op_type === 'DATA_LINK' ? 'link' : 'unlink',
                )
                if (
                  lastDetails.consolidated_ref_display_values_links?.length > 0 ||
                  lastDetails.consolidated_ref_display_values_unlinks?.length
                ) {
                  last.details = JSON.stringify(lastDetails)
                } else {
                  result.pop()
                }
              } else {
                applyLinkAuditValue(
                  details,
                  details.ref_row_id,
                  details.ref_display_value,
                  current.op_type === 'DATA_LINK' ? 'link' : 'unlink',
                )
                current.details = JSON.stringify(details)
                result.push(current)
              }
            }
          } else if (current.op_type === 'DATA_UPDATE') {
            const last = result.findLast((it) => it.op_type === 'DATA_UPDATE')
            if (!last || last.user !== current.user || dayjs(current.created_at).diff(dayjs(last.created_at), 'second') > 30) {
              result.push(current)
              continue
            }
            const details = JSON.parse(current.details)
            const lastDetails = JSON.parse(last.details)
            for (const field of Object.values(details.column_meta ?? {}) as any[]) {
              if (['MultiSelect', 'SingleSelect'].includes(field.type) && lastDetails?.column_meta?.[field?.title]) {
                lastDetails.data[field.title] = details.data[field.title]
                for (const option of details.column_meta[field.title]?.options?.choices ?? []) {
                  if (!lastDetails.column_meta[field.title]?.options.choices.find((it: any) => it.id === option.id)) {
                    lastDetails.column_meta[field.title].options.choices.push(option)
                  }
                }
                last.details = JSON.stringify(lastDetails)
                delete details.old_data[field.title]
                delete details.data[field.title]
                delete details.column_meta[field.title]
                current.details = JSON.stringify(details)
              } else if (lastDetails?.column_meta?.[field?.title] && lastDetails.old_data[field.title]) {
                lastDetails.data[field.title] = details.data[field.title]
                last.details = JSON.stringify(lastDetails)
                delete details.old_data[field.title]
                delete details.data[field.title]
                delete details.column_meta[field.title]
                current.details = JSON.stringify(details)
              } else if (details?.column_meta?.[field?.title] && !lastDetails?.column_meta?.[field?.title]) {
                if (!lastDetails.column_meta) lastDetails.column_meta = {}
                if (!lastDetails.old_data) lastDetails.old_data = {}
                if (!lastDetails.data) lastDetails.data = {}
                lastDetails.column_meta[field.title] = details.column_meta[field.title]
                lastDetails.old_data[field.title] = details.old_data[field.title]
                lastDetails.data[field.title] = details.data[field.title]
                last.details = JSON.stringify(lastDetails)
                delete details.old_data[field.title]
                delete details.data[field.title]
                delete details.column_meta[field.title]
                current.details = JSON.stringify(details)
              }
            }
            if (Object.values(details.column_meta).length > 0) {
              result.push(current)
            }
          } else {
            result.push(current)
          }
        }
      } catch (e) {
        console.error(e)
      }

      return result
    })

    const auditCommentGroups = computed(() => {
      const adts = [...consolidatedAudits.value].map((it) => ({
        user: it.user,
        displayName: it.created_display_name,
        displayNameShort: it.created_display_name_short,
        created_at: it.created_at,
        type: 'audit',
        audit: it,
      }))

      const cmnts = [...comments.value].map((it) => ({
        ...it,
        user: it.created_by_email,
        displayName: it.created_display_name,
        displayNameShort: it.created_display_name_short,
        type: 'comment',
      }))

      const groups = [...adts, ...cmnts]

      return groups.sort((a, b) => {
        return dayjs(a.created_at).isBefore(dayjs(b.created_at)) ? -1 : 1
      })
    })

    const baseRoles = computedAsync(async () => {
      // if active base id and meta base id is different, then extract the base roles of the meta base
      if (meta.value?.base_id !== base.value?.id) {
        return await basesStore.getBaseRoles(meta.value?.base_id, {
          skipUpdatingUser: true,
        })
      }
    })

    const activeDataListener = ref<string | null>(null)
    const activeCommentListener = ref<string | null>(null)

    watch(
      meta,
      (newMeta, oldMeta) => {
        if (newMeta?.fk_workspace_id && newMeta?.base_id && newMeta?.id) {
          if (oldMeta?.id && oldMeta.id === newMeta.id) return

          if (activeDataListener.value) {
            $ncSocket.offMessage(activeDataListener.value)
          }

          if (activeCommentListener.value) {
            $ncSocket.offMessage(activeCommentListener.value)
          }

          activeDataListener.value = $ncSocket.onMessage(
            `${EventType.DATA_EVENT}:${newMeta.fk_workspace_id}:${newMeta.base_id}:${newMeta.id}`,
            (data: DataPayload) => {
              const { id, action, payload } = data

              const activePk = extractPkFromRow(row.value.row, meta.value?.columns as ColumnType[])

              if (`${id}` === activePk) {
                if (action === 'update') {
                  try {
                    if (payload) {
                      // Merge payload with local row, but preserve locally changed columns
                      const mergedRow = { ...row.value.row, ...payload }
                      for (const col of changedColumns.value) {
                        if (Object.prototype.hasOwnProperty.call(row.value.row, col)) {
                          mergedRow[col] = row.value.row[col]
                          if (row.value.row[col] !== payload[col]) {
                            localOnlyChanges.value[col] = payload[col]
                          }
                        }
                      }
                      Object.assign(row.value, {
                        row: mergedRow,
                        oldRow: { ...mergedRow },
                      })
                      // Do NOT clear changedColumns here, as we want to preserve local changes
                    } else {
                      console.warn('No payload provided for update action')
                    }
                  } catch (e) {
                    console.error('Failed to update cached row on socket event', e)
                  }
                } else if (action === 'delete') {
                  try {
                    //
                  } catch (e) {
                    console.error('Failed to delete cached row on socket event', e)
                  }
                }
              }
            },
          )

          activeCommentListener.value = $ncSocket.onMessage(
            `${EventType.COMMENT_EVENT}:${newMeta.fk_workspace_id}:${newMeta.base_id}:${newMeta.id}`,
            (data: CommentPayload) => {
              const { action, id, payload } = data

              if (primaryKey.value && `${id}` === `${primaryKey.value}`) {
                const commentId = payload.id
                const user = baseUsers.value.find((u) => u.id === payload.created_by)
                const finalPayload = {
                  ...payload,
                  created_display_name: user?.display_name,
                  created_display_name_short: user?.display_name ?? extractNameFromEmail(user?.email),
                  created_by_email: user?.email,
                  created_by_meta: user?.meta,
                }

                if (action === 'add') {
                  comments.value.push(finalPayload)
                } else if (action === 'update') {
                  const index = comments.value.findIndex((comment) => comment.id === commentId)
                  if (index !== -1) {
                    comments.value[index] = finalPayload
                  }
                } else if (action === 'delete') {
                  comments.value = comments.value.filter((comment) => comment.id !== commentId)
                }
              }
            },
          )
        }
      },
      { immediate: true },
    )

    const unsubscribeActiveChannels = (): void => {
      ;[activeDataListener.value, activeCommentListener.value].filter(Boolean).forEach((channel) => {
        $ncSocket.offMessage(channel!)
      })
    }

    onBeforeUnmount(() => {
      unsubscribeActiveChannels()
    })

    return {
      ...rowStore,
      loadComments,
      deleteComment,
      loadAudits,
      comments,
      audits,
      isAuditLoading,
      clearColumns,
      auditCommentGroups,
      consolidatedAudits,
      hasMoreAudits,
      loadMoreAudits,
      resetAuditPages,
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
      localOnlyChanges,
      loadRow,
      primaryKey,
      saveRowAndStay,
      updateComment,
      baseRoles,
      fieldsFromParent,
      fields,
      hiddenFields,
      isAllowedAddNewRecord,
      getIsAllowedEditField,
      meta,
    }
  },
  'expanded-form-store',
)

export { useProvideExpandedFormStore }

export function useExpandedFormStoreOrThrow() {
  const expandedFormStore = useExpandedFormStore()

  if (expandedFormStore == null) throw new Error('Please call `useExpandedFormStore` on the appropriate parent component')

  return expandedFormStore
}
