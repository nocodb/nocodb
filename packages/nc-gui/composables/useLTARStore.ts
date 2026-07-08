import type { ColumnType, LinkToAnotherRecordType, PaginatedType, RequestParams, TableType } from 'nocodb-sdk'
import {
  RelationTypes,
  UITypes,
  dateFormats,
  hideExtraFieldsMetaKey,
  isBtLikeV2Junction,
  isDateOrDateTimeCol,
  isLinkV2,
  isLinksOrLTAR,
  isSystemColumn,
  parseStringDateTime,
  timeFormats,
} from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { reconcilePendingLtarOp, resolveDeferredLtarCount, resolveDeferredSingleTargetValue } from '~/utils/ltarDeferredOps'

interface DataApiResponse {
  list: Record<string, any>[]
  pageInfo: PaginatedType
}

/** Store for managing Link to another cells */
const [useProvideLTARStore, useLTARStore] = useInjectionState(
  (
    column: Ref<Required<ColumnType>> | ComputedRef<Required<ColumnType>>,
    row: Ref<Row>,
    isNewRow: ComputedRef<boolean> | Ref<boolean>,
    _reloadData = (_params: { shouldShowLoading?: boolean }) => {},
  ) => {
    // when initialized by link popup dialog, keep current row
    // to avoid being changed by sort or filter
    const currentRow = ref(row.value)

    // Row store: provides addLTARRef/removeLTARRef (new-row local buffering) and the
    // pendingLtarOps queue (existing-row deferred edits, #14013/#14058). Acquired early
    // because syncPendingLinkRows + the deferred child-count both read the queue.
    // Read-only consumers (e.g. Page Designer) may have no row store.
    const smartsheetRowStore = useSmartsheetRowStore()
    const addLTARRef = smartsheetRowStore?.addLTARRef
    const removeLTARRef = smartsheetRowStore?.removeLTARRef
    const pendingLtarOps = smartsheetRowStore?.pendingLtarOps
    const rowStoreCurrentRow = smartsheetRowStore?.currentRow

    // Related records queued as pending links for this column (existing-row deferral).
    const queuedLinkRecords = () =>
      (pendingLtarOps?.value ?? []).filter((o) => o.columnId === column.value.id && o.op === 'link').map((o) => o.record)

    // Related records the user has queued for unlink (existing-row deferral). The server's
    // excluded list omits these because they're still linked until save, so they would vanish
    // from the link picker with no way to re-add — surface them so they stay re-linkable from
    // "Link more records" (#14013). Pure computed over the reactive queue; unlink only applies
    // to existing rows (new rows have no persisted links to remove).
    const pendingUnlinkRows = computed<Record<string, any>[]>(() =>
      isNewRow?.value
        ? []
        : (pendingLtarOps?.value ?? []).filter((o) => o.columnId === column.value.id && o.op === 'unlink').map((o) => o.record),
    )

    const refreshCurrentRow = () => {
      currentRow.value = row.value
    }

    if (isEeUI) {
      _reloadData = (_params: { shouldShowLoading?: boolean }) => {}
    }

    // state
    const { getMeta, getMetaByKey, getPartialMeta, metas } = useMetas()

    const { base, isSharedBase } = storeToRefs(useBase())

    const { isPg } = useBase()

    const { getBaseRoles } = useBases()

    const { $api, $e } = useNuxtApp()

    const { isMobileMode } = useGlobal()

    const isForm = inject(IsFormInj, ref(false))

    // True only when this store lives inside the Expand Record form subtree
    // (component-tree scoped). Grid inline link cells get the default `false`.
    const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

    const path = inject(GroupPathInj, ref([]))

    const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

    const childrenExcludedList = ref<DataApiResponse | undefined>()
    const childrenList = ref<DataApiResponse | undefined>()
    const targetViewColumns = ref<ColumnType[]>([])

    const targetViewColumnsById = computed(() => {
      return targetViewColumns.value.reduce((map, col) => {
        map[col.fk_column_id!] = col
        return map
      }, {} as Record<string, ColumnType>)
    })

    const childrenExcludedListPagination = reactive({
      page: 1,
      query: '',
      size: 10,
    })

    const childrenExcludedOffsetCount = ref(0)

    const childrenListPagination = reactive({
      page: 1,
      query: '',
      size: 10,
    })

    const childrenListOffsetCount = ref(0)

    const isChildrenLoading = ref(false)

    const isChildrenListLoading = ref<Array<boolean>>([])

    const isChildrenListLinked = ref<Array<boolean>>([])

    const isChildrenExcludedListLoading = ref<Array<boolean>>([])

    const isChildrenExcludedLoading = ref(false)

    const isChildrenExcludedListLinked = ref<Array<boolean>>([])

    // --- Chunked cache for virtual scroll ---
    const CHUNK_SIZE = 10
    const MAX_CACHE_SIZE = 50
    const ROW_HEIGHT = 56

    // Excluded list (unlinked items) cache
    const excludedCachedRows = ref<Map<number, Record<string, any>>>(new Map())
    const excludedTotalRows = ref(0)
    const excludedChunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])
    const excludedLinkedState = ref<Map<number, boolean>>(new Map())
    const excludedLoadingState = ref<Map<number, boolean>>(new Map())

    // Children list (linked items) cache
    const childrenCachedRows = ref<Map<number, Record<string, any>>>(new Map())
    const childrenCachedTotalRows = ref(0)
    const childrenChunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])
    const childrenCachedLinkedState = ref<Map<number, boolean>>(new Map())
    const childrenCachedLoadingState = ref<Map<number, boolean>>(new Map())

    const newRowState = reactive({
      state: null,
    })

    const childrenListCount = ref(0)

    // Buffered (deferred, not-yet-saved) links to surface in the child-list modal
    // for an existing row edited in the expanded form. Kept as a dedicated ref
    // synced explicitly via syncPendingLinkRows() — the buffers live on the
    // row-store row as plain nested objects, which a computed on this store's
    // (snapshot) currentRow would not track reactively.
    const pendingLinkRows = ref<Record<string, any>[]>([])

    // Refresh the dedicated pendingLinkRows ref from the deferred buffers.
    // Existing rows read the pendingLtarOps queue (#14058); new rows still read the
    // ltarState buffer. Normalises single-target (object) and multi-target (array) shapes.
    const syncPendingLinkRows = () => {
      if (isNewRow?.value) {
        const buffered = currentRow.value?.rowMeta?.ltarState?.[column.value?.title as string]
        pendingLinkRows.value = !buffered ? [] : Array.isArray(buffered) ? [...buffered] : [buffered]
      } else {
        pendingLinkRows.value = queuedLinkRecords()
      }
    }

    const { t } = useI18n()

    const isPublic: Ref<boolean> = inject(IsPublicInj, ref(false))

    const colOptions = computed(() => column.value?.colOptions as LinkToAnotherRecordType)

    const type = computed(() => colOptions.value?.type as RelationTypes)

    const isSingleTargetRelation = computed(() => {
      return (
        colOptions.value?.type === RelationTypes.MANY_TO_ONE ||
        colOptions.value?.type === RelationTypes.BELONGS_TO ||
        colOptions.value?.type === RelationTypes.ONE_TO_ONE ||
        isBtLikeV2Junction(column.value)
      )
    })

    const { sharedView } = useSharedView()

    const { getViewColumns } = useSmartsheetStoreOrThrow()

    const { getValidSearchQueryForColumn } = useFieldQuery()

    const baseId = base.value?.id || (sharedView.value?.view as any)?.base_id

    // getters
    const meta = computed(() => getMetaByKey(column?.value?.base_id as string, column?.value?.fk_model_id as string))
    const relatedTableMeta = computed<TableType>(() => {
      const relatedBaseId = colOptions.value?.fk_related_base_id || column?.value?.base_id
      return getMetaByKey(relatedBaseId as string, colOptions.value?.fk_related_model_id as string)
    })

    // Check if linked table is accessible based on is_private flag from API response only
    const isLinkedTableAccessible = computed(() => {
      if (!colOptions.value?.fk_related_model_id) return true
      // Check if table is marked as private from API response
      return !(relatedTableMeta.value as any)?.is_private
    })

    const rowId = computed(() => extractPkFromRow(currentRow.value?.row, meta.value?.columns))

    // When true, link/unlink buffer the change locally and persist on save instead
    // of hitting the API immediately. Holds for brand-new rows (no pk yet) and for
    // existing rows edited inside the Expand Record form (#14013) — matching the
    // buffered behavior of every other field type. Grid inline editing stays immediate.
    const shouldDefer = computed(() => isNewRow?.value || !rowId.value || isExpandedFormOpen.value)

    const showExtraFields = computed(() => {
      return !isForm.value || !parseProp(column.value?.meta)?.[hideExtraFieldsMetaKey]
    })

    const getRelatedTableRowId = (row: Record<string, any>) => {
      return extractPkFromRow(row, relatedTableMeta.value?.columns)
    }

    // actions

    const loadRelatedTableMeta = async () => {
      const relatedBaseId = colOptions.value.fk_related_base_id || column.value.base_id
      if (!relatedBaseId) {
        console.error('Cannot load related table meta: base_id not found')
        return
      }

      const tableId = colOptions.value.fk_related_model_id as string
      const colId = colOptions.value.fk_column_id as string

      const metaKey = `${relatedBaseId}:${tableId}`

      // Only skip the full-meta call for a cross-base LTAR rendered inside a
      // shared view or shared base — the viewer has no access to the external
      // base there, so getMeta would 403. In the logged-in dashboard always
      // try getMeta (the user may have access to both bases).
      const isCrossBase = relatedBaseId !== column.value.base_id
      const skipGetMeta = isCrossBase && (isPublic.value || isSharedBase.value)
      if (!skipGetMeta) {
        try {
          await getMeta(relatedBaseId, tableId, false, false, true)
        } catch {}
      }
      if (!metas.value[metaKey]) {
        await getPartialMeta(relatedBaseId, colId, tableId)
      }

      if (isPublic.value) return

      await nextTick()

      const viewId = colOptions.value.fk_target_view_id ?? relatedTableMeta.value?.views?.[0]?.id ?? ''
      if (!viewId) return

      try {
        // Pass relatedBaseId as first parameter for proper cross-base support
        targetViewColumns.value = (await getViewColumns(relatedBaseId, viewId)) ?? []
      } catch (e) {
        console.error('Failed to load related table view columns:', e)
        targetViewColumns.value = []
        message.error('Failed to load related table view columns')
      }
    }

    const relatedTableDisplayValueColumn = computed(() => {
      const colOptions = (column.value?.colOptions as LinkToAnotherRecordType) || {}

      if (colOptions.fk_display_value_column_id) {
        const overrideCol = relatedTableMeta.value?.columns?.find((c) => c.id === colOptions.fk_display_value_column_id)
        if (overrideCol) return overrideCol
      }

      return relatedTableMeta.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0]
    })

    const relatedTableDisplayValueProp = computed(() => {
      return relatedTableDisplayValueColumn.value?.title || ''
    })

    // todo: temp fix, handle in backend
    const relatedTableDisplayValuePropId = computed(() => {
      return relatedTableDisplayValueColumn.value?.id || ''
    })

    const displayValueProp = computed(() => {
      return (meta.value?.columns?.find((c: Required<ColumnType>) => c.pv) || meta?.value?.columns?.[0])?.title
    })

    const displayValueTypeAndFormatProp = computed(() => {
      let displayValueTypeAndFormat = {
        type: '',
        format: '',
      }
      const currentColumn = relatedTableDisplayValueColumn.value

      if (currentColumn) {
        if (currentColumn?.uidt === UITypes.DateTime) {
          displayValueTypeAndFormat = {
            type: currentColumn?.uidt,
            format: `${parseProp(currentColumn?.meta)?.date_format ?? dateFormats[0]} ${
              parseProp(currentColumn?.meta)?.time_format ?? timeFormats[0]
            }`,
          }
        }
        if (currentColumn?.uidt === UITypes.Time) {
          displayValueTypeAndFormat = {
            type: currentColumn?.uidt,
            format: `${timeFormats[0]}`,
          }
        }
      }
      return displayValueTypeAndFormat
    })

    const headerDisplayValue = computed(() => {
      if (
        row.value.row[displayValueProp.value] &&
        displayValueTypeAndFormatProp.value.type &&
        displayValueTypeAndFormatProp.value.format
      ) {
        return parseStringDateTime(
          row.value.row[displayValueProp.value],
          displayValueTypeAndFormatProp.value.format,
          !(displayValueTypeAndFormatProp.value.format === UITypes.Time),
        )
      }
      return row.value.row[displayValueProp.value]
    })

    const attachmentCol = computedInject(
      FieldsInj,
      (_fields) => {
        return (relatedTableMeta.value?.columns ?? []).filter((col) => isAttachment(col))[0]
      },
      ref([]),
    )

    const fields = computedInject(
      FieldsInj,
      (_fields) => {
        const colOptions = (column.value?.colOptions as LinkToAnotherRecordType) || {}
        const hasCustomDisplayValue = !!colOptions.fk_display_value_column_id

        const filteredFields = (relatedTableMeta.value?.columns ?? []).filter((col) => {
          // Hide the custom display value column from extra fields since it's already shown as the primary display
          if (hasCustomDisplayValue && col.id === colOptions.fk_display_value_column_id) return false

          // Hiding lookup field from dropdown as we don't send lookup field info in list response due to performance reasons
          return !isSystemColumn(col) && !isPrimary(col) && !isLinksOrLTAR(col) && !isAttachment(col) && !isLookup(col)
        })

        // Resolve a stable sort order for each extra field:
        //   1. the target view's column order — authoritative when loaded
        //   2. else the field's default-view order — always present on meta
        // Public views never load target-view columns, so they use (2). Cross-base
        // links can also end up with no target-view columns (they load from the
        // external base and may come back empty), and without a fallback every
        // field resolved to Infinity — `Infinity - Infinity` is NaN, which makes
        // Array.sort bail and surface raw table-creation order (the reported
        // "notes / model / old-values on top instead of the display fields" bug).
        const fieldOrder = (col: ColumnType) => {
          const viewOrder = isPublic.value ? undefined : targetViewColumnsById.value[col.id!]?.order
          return viewOrder ?? col.meta?.defaultViewColOrder ?? Infinity
        }

        const sortedFields = filteredFields.sort((a, b) => {
          const diff = fieldOrder(a) - fieldOrder(b)
          return Number.isNaN(diff) ? 0 : diff
        })

        // When a custom display value is set, prepend the original PV as the first extra field
        // so it's guaranteed to be present regardless of the slice limit below.
        if (hasCustomDisplayValue) {
          const pvCol = (relatedTableMeta.value?.columns ?? []).find(
            (c) => isPrimary(c) && !isSystemColumn(c) && !isLinksOrLTAR(c) && !isAttachment(c) && !isLookup(c),
          )
          if (pvCol) sortedFields.unshift(pvCol)
        }

        return sortedFields.slice(0, isMobileMode.value ? 1 : 3)
      },
      ref([]),
    )

    const fieldsToLoad = computed(() => {
      return [
        relatedTableDisplayValueColumn.value,
        ...(relatedTableMeta.value?.columns?.filter((c) => c.pk) || []),
        ...(attachmentCol.value ? [attachmentCol.value] : []),
        ...(fields.value || []),
      ].filter((c) => c)
    })

    const requiredFieldsToLoad = computed(() => {
      return Array.from(new Set(fieldsToLoad.value?.map((f) => f.id as string)))
    })

    // extract external base roles if cross base link
    const externalBaseUserRoles = computedAsync(async () => {
      if (base.value?.id && base.value?.id === relatedTableMeta.value?.base_id) return

      return await getBaseRoles(relatedTableMeta.value?.base_id, {
        skipUpdatingUser: true,
      })
    })

    /**
     * Extract only primary key(pk) and primary value(pv) column data
     */
    const extractOnlyPrimaryValues = async (value: any, col: ColumnType) => {
      const currColOptions = (col.colOptions || {}) as LinkToAnotherRecordType
      const relatedBaseId = currColOptions.fk_related_base_id || column.value.base_id

      await getMeta(relatedBaseId, currColOptions.fk_related_model_id as string)

      const currColRelatedTableMeta = getMetaByKey(relatedBaseId, currColOptions?.fk_related_model_id as string)

      if (!currColRelatedTableMeta) return

      const primaryCols = (currColRelatedTableMeta?.columns || []).filter((c) => c.pv || c.pk)

      const extractValues = (value: any, primaryCols: ColumnType[]): any => {
        if (ncIsArray(value)) {
          return value.map((val) => extractValues(val, primaryCols)).filter(Boolean)
        }

        if (!ncIsObject(value)) return null

        const extractedValues: Record<string, any> = {}

        for (const c of primaryCols) {
          const val = value[c.title]

          if (ncIsUndefined(val) || ncIsNull(val)) continue

          extractedValues[c.title] = val
        }

        return extractedValues
      }

      return extractValues(value, primaryCols)
    }

    /**
     * Sanitization of row is requried because we will send this info in api query params
     * And query param has limit to send data
     * So it's better to send only requried row data which will be used for `Limit record selection to filters`
     */
    const sanitizeRowData = async (row: Record<string, any> = {}) => {
      const sanitizedRow: Record<string, any> = {}

      /**
       * Note: No need to send row data if `Limit record selection to filters` is not enabled
       */
      if (!ncIsObject(row) || !parseProp(column.value?.meta).enableConditions) return {}

      for (const col of meta.value.columns) {
        const value = row[col.title]

        if (ncIsUndefined(value) || ncIsNull(value)) continue

        switch (col.uidt) {
          case UITypes.Attachment: {
            /**
             * Attachment object is to big as this includes data base64/file object and for filter only required title.
             * So extract only title
             */
            if (ncIsArray(value)) {
              sanitizedRow[col.title] = value.map((item) => (item?.title ? { title: item?.title } : null)).filter(Boolean)
            }
            break
          }
          case UITypes.Links:
          case UITypes.LinkToAnotherRecord: {
            /**
             * Links/LTAR object is also big as in new record it will include while linked record data(depends on how many columns related table has)
             * So extract only primary column values (pk & pv)
             */
            const res = await extractOnlyPrimaryValues(value, col)
            if (res) {
              sanitizedRow[col.title] = res
            }
            break
          }

          default: {
            sanitizedRow[col.title] = value
          }
        }
      }

      return sanitizedRow
    }

    const getWhereClause = (searchQuery?: string) => {
      if (!searchQuery || !relatedTableDisplayValueColumn.value) return

      const query = searchQuery.trim()
      if (!query) return

      const displayCol = relatedTableDisplayValueColumn.value

      // Date/DateTime display value: keep single-column exact date search (used with date picker input)
      if (isDateOrDateTimeCol(displayCol)) {
        return `(${displayCol.title},eq,exactDate,${query})`
      }

      // Collect all searchable columns: display value + extra fields shown in dropdown
      const columnsToSearch = [displayCol, ...(fields.value || [])].filter((col) => isSearchableColumn(col))

      const clauses = columnsToSearch
        .map((col) => {
          return getValidSearchQueryForColumn(col, query, relatedTableMeta.value, {
            getWhereQueryAs: 'string',
            serializeLinkRecordSearchQuery: true,
          }) as string
        })
        .filter(Boolean)

      if (clauses.length === 0) return

      return clauses.join('~or')
    }

    const loadChildrenExcludedList = async (activeState?: any, resetOffset = false) => {
      if (activeState) newRowState.state = activeState
      try {
        let offset =
          childrenExcludedListPagination.size * (childrenExcludedListPagination.page - 1) - childrenExcludedOffsetCount.value

        if (offset < 0 || resetOffset) {
          offset = 0
          childrenExcludedOffsetCount.value = 0
          childrenExcludedListPagination.page = 1
        }
        isChildrenExcludedLoading.value = true
        const where = getWhereClause(childrenExcludedListPagination.query)

        if (isPublic.value) {
          const router = useRouter()

          const route = router.currentRoute

          let row
          // if shared form extract the current form state
          if (isForm.value) {
            const { formState, additionalState } = useSharedFormStoreOrThrow()

            row = await sanitizeRowData({ ...(formState?.value || {}), ...(additionalState?.value || {}) })
          }

          childrenExcludedList.value = await $api.public.dataRelationList(
            route.value.params.viewId as string,
            column.value.id,
            {},
            {
              headers: {
                'xc-password': sharedViewPassword.value,
              },
              query: {
                limit: childrenExcludedListPagination.size,
                offset,
                where,
                fields: requiredFieldsToLoad.value,
                // todo: include only required fields
                rowData: JSON.stringify(row),
              } as RequestParams,
            },
          )

          /** if new row load all records */
        } else if (isNewRow?.value) {
          const linkRowData = await sanitizeRowData(row.value.row)

          childrenExcludedList.value = await $api.internal.getOperation(
            (column.value as any).fk_workspace_id!,
            column.value!.base_id!,
            {
              operation: 'linkDataList',
              limit: childrenExcludedListPagination.size,
              offset,
              where,
              columnId: column.value.fk_column_id || column.value.id,
              linkRowData: JSON.stringify(linkRowData),
            },
          )
          const ids = new Set(childrenList.value?.list?.map((item) => item.Id) ?? [])
          if (childrenExcludedList.value.list && ids.size) {
            childrenExcludedList.value.list = childrenExcludedList.value.list.filter((item) => !ids.has(item.Id))
          }
        } else {
          // extract changed data and include with the api call if any
          let changedRowData
          try {
            if (row.value?.row) {
              changedRowData = Object.keys(row.value?.row).reduce((acc: Record<string, any>, key: string) => {
                if (row.value.row[key] !== row.value.oldRow[key]) acc[key] = row.value.row[key]
                return acc
              }, {})

              changedRowData = await sanitizeRowData(changedRowData)
            }
          } catch {}

          childrenExcludedList.value = await $api.dbTableRow.nestedChildrenExcludedList(
            NOCO,
            meta.value?.base_id ?? baseId,
            meta.value.id,
            encodeURIComponent(rowId.value),
            type.value,
            column?.value?.id,
            {
              limit: String(childrenExcludedListPagination.size),
              offset: String(offset),
              where,
              linkRowData: changedRowData ? JSON.stringify(changedRowData) : undefined,
              fields: requiredFieldsToLoad.value,
            } as any,
          )
        }

        childrenExcludedList.value?.list.forEach((row: Record<string, any>, index: number) => {
          isChildrenExcludedListLinked.value[index] = false
          isChildrenExcludedListLoading.value[index] = false
        })

        if (childrenExcludedList.value?.list && activeState && activeState[column.value.title]) {
          // Mark out exact same objects in activeState[column.value.title] as Linked
          // compare all keys and values
          childrenExcludedList.value.list.forEach((row: any, index: number) => {
            const found = (
              isSingleTargetRelation.value ? [activeState[column.value.title]] : activeState[column.value.title]
            ).find((a: any) => {
              let isSame = true

              for (const key in a) {
                if (a[key] !== row[key]) {
                  isSame = false
                }
              }
              return isSame
            })

            if (found) {
              isChildrenExcludedListLinked.value[index] = true
            }
          })
        }

        // Seed the virtual-scroll chunk cache from this response. pagination.size is
        // aligned with CHUNK_SIZE so the first page fills exactly chunk 0 — deeper
        // chunks are still lazy-loaded by fetchExcludedChunk on viewport scroll.
        if (offset === 0 && ncIsArray(childrenExcludedList.value?.list)) {
          childrenExcludedList.value.list.forEach((row: Record<string, any>, index: number) => {
            excludedCachedRows.value.set(index, row)
            excludedLinkedState.value.set(index, isChildrenExcludedListLinked.value[index] || false)
            excludedLoadingState.value.set(index, false)
          })
          if (childrenExcludedList.value.list.length > 0) {
            excludedChunkStates.value[0] = 'loaded'
          }
          if (childrenExcludedList.value.pageInfo?.totalRows != null) {
            excludedTotalRows.value = +childrenExcludedList.value.pageInfo.totalRows
          }
        }
      } catch (e: any) {
        // temporary fix to handle when offset is beyond limit
        const error = await extractSdkResponseErrorMsgv2(e)

        if (error.error === NcErrorType.ERR_INVALID_OFFSET_VALUE) {
          childrenExcludedListPagination.page = 0
          return loadChildrenExcludedList(activeState, true)
        }

        message.error(`${t('msg.error.failedToLoadList')}: ${error.message}`)
      } finally {
        isChildrenExcludedLoading.value = false
      }
    }

    const loadChildrenList = async (resetOffset = false, activeState: any = undefined, limit: number | undefined = undefined) => {
      if (activeState) newRowState.state = activeState

      try {
        isChildrenLoading.value = true
        if (isSingleTargetRelation.value && !isLinkV2(column.value)) return
        if (!column.value) return
        let offset = childrenListPagination.size * (childrenListPagination.page - 1) + childrenListOffsetCount.value
        if (offset < 0 || resetOffset) {
          offset = 0
          childrenListOffsetCount.value = 0
          childrenListPagination.page = 1
        } else if (offset >= childrenListCount.value) {
          offset = 0
        }

        if (isNewRow?.value || !rowId.value) {
          const colTitle = column.value?.title || ''
          const rawList = newRowState.state?.[colTitle] ?? []
          const query = childrenListPagination.query.toLocaleLowerCase()
          const list = query
            ? rawList.filter((record: Record<string, any>) =>
                `${record[relatedTableDisplayValueProp.value] ?? ''}`.toLocaleLowerCase().includes(query),
              )
            : rawList
          childrenList.value = {
            list,
            pageInfo: {
              isFirstPage: true,
              isLastPage: list.length <= 10,
              page: 1,
              pageSize: 10,
              totalRows: list.length,
            },
          }
        } else {
          const where = getWhereClause(childrenListPagination.query)

          if (isPublic.value) {
            childrenList.value = await $api.public.dataNestedList(
              sharedView.value?.uuid as string,
              encodeURIComponent(rowId.value),
              type.value as RelationTypes,
              column.value.id,
              {
                limit: String(childrenListPagination.size),
                offset: String(offset),
                where,
              } as any,
              {
                headers: {
                  'xc-password': sharedViewPassword.value,
                },
              },
            )
          } else {
            childrenList.value = await $api.dbTableRow.nestedList(
              NOCO,
              meta.value?.base_id ?? ((base?.value?.id || (sharedView.value?.view as any)?.base_id) as string),
              meta.value.id,
              encodeURIComponent(rowId.value),
              type.value as RelationTypes,
              column?.value?.id,
              {
                limit: String(limit ?? childrenListPagination.size),
                offset: String(offset),
                where,
                fields: requiredFieldsToLoad.value,
              } as any,
            )
          }
        }
        if (ncIsArray(childrenList.value?.list)) {
          childrenList.value.list.forEach((row: Record<string, any>, index: number) => {
            isChildrenListLinked.value[index] = true
            isChildrenListLoading.value[index] = false
          })
        }

        if (!childrenListPagination.query) {
          let total = childrenList.value?.pageInfo.totalRows ?? 0
          // Account for queued (deferred, unsaved) link/unlink so the count doesn't revert
          // to the persisted total when the modal is reopened (#14058).
          if (shouldDefer.value && !isNewRow?.value && rowId.value && pendingLtarOps) {
            total = resolveDeferredLtarCount(pendingLtarOps.value, column.value.id as string, total)
          }
          childrenListCount.value = total
        }

        // Seed the virtual-scroll chunk cache from this response. pagination.size is
        // aligned with CHUNK_SIZE so the first page fills exactly chunk 0 — deeper
        // chunks are still lazy-loaded by fetchChildrenChunk on viewport scroll.
        if (offset === 0 && ncIsArray(childrenList.value?.list)) {
          childrenList.value.list.forEach((row: Record<string, any>, index: number) => {
            childrenCachedRows.value.set(index, row)
            childrenCachedLinkedState.value.set(index, true)
            childrenCachedLoadingState.value.set(index, false)
          })
          if (childrenList.value.list.length > 0) {
            childrenChunkStates.value[0] = 'loaded'
          }
          if (childrenList.value.pageInfo?.totalRows != null) {
            childrenCachedTotalRows.value = +childrenList.value.pageInfo.totalRows
          }
        }
      } catch (e: any) {
        message.error(`${t('msg.error.failedToLoadChildrenList')}: ${await extractSdkResponseErrorMsg(e)}`)
      } finally {
        isChildrenLoading.value = false
      }

      // Seed the pending-links section when (re)opening the child list for an
      // existing row in deferred mode, so already-buffered links show up.
      if (shouldDefer.value && !isNewRow?.value && rowId.value) {
        syncPendingLinkRows()
      }

      return childrenList.value
    }

    const deleteRelatedRow = async (row: Record<string, any>, onSuccess?: (row: Record<string, any>) => void) => {
      Modal.confirm({
        title: 'Do you want to delete the record?',
        type: 'warning',
        onOk: async () => {
          const id = getRelatedTableRowId(row)
          try {
            const res: { message?: string[] } | number = await $api.dbTableRow.delete(
              NOCO,
              relatedTableMeta.value?.base_id ?? baseId,
              relatedTableMeta.value.id as string,
              encodeURIComponent(id as string),
            )

            if (res.message) {
              message.info(
                `Record delete failed: ${`Unable to delete record with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
              )
              return false
            }

            _reloadData?.({ shouldShowLoading: false, path: path.value })

            /** reload child list if not a new row */
            if (!isNewRow?.value) {
              await loadChildrenList()
            }
            onSuccess?.(row)

            $e('a:links:delete-related-row')
          } catch (e: any) {
            message.error(`${t('msg.error.deleteFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
          }
        },
      })
    }

    // Queue a deferred link/unlink for an existing row (reconciled into pendingLtarOps).
    // Defined here (not with the early acquisition) because it needs rowId/type/getRelatedTableRowId.
    const enqueueLtarOp = (op: 'link' | 'unlink', relatedRow: Record<string, any>) => {
      if (!pendingLtarOps) return
      reconcilePendingLtarOp(pendingLtarOps.value, {
        op,
        columnId: column.value.id as string,
        baseId: (meta.value?.base_id ?? base.value?.id) as string,
        tableId: meta.value?.id as string,
        rowId: rowId.value as string,
        type: type.value as RelationTypes,
        relatedRowId: `${getRelatedTableRowId(relatedRow)}`,
        record: relatedRow,
      })
    }

    // Re-derive the cell's optimistic value/count for an existing row purely from the
    // persisted base (oldRow) + the queued ops, so display never drifts from the queue
    // (e.g. unlink-then-relink restores the original count/value). New rows drive their
    // display from ltarState directly, so they're skipped here. (#14058)
    const refreshDeferredDisplay = () => {
      if (!rowStoreCurrentRow || !pendingLtarOps || isNewRow?.value) return
      const cur = rowStoreCurrentRow.value
      const colTitle = column.value.title as string
      const colId = column.value.id as string
      const queue = pendingLtarOps.value
      const base = cur.oldRow?.[colTitle]

      // Single-target (BT/OO/MO): the cell holds one linked record (or null).
      if (isSingleTargetRelation.value) {
        cur.row[colTitle] = resolveDeferredSingleTargetValue(queue, colId, base ?? null)
        return
      }

      // Multi-target: keep the child-list count badge in sync, and preserve the cell
      // value's SHAPE — which is decided by the CELL RENDERER (uidt), not the link version.
      // A `Links` cell renders a numeric rollup count; a `LinkToAnotherRecord` hm/mm cell
      // renders an array of chips (ManyToMany/HasMany.vue call .reduce on it) even when the
      // relation is version V2. Keying off `isLinkV2` (version) here wrote a bare count into a
      // LinkToAnotherRecord cell, so `localCellValue` fell back to [] and the cell appeared to
      // clear on every deferred edit until save (#14013).
      const persistedCount = Array.isArray(base) ? base.length : +(base ?? 0) || 0
      const count = resolveDeferredLtarCount(queue, colId, persistedCount)
      childrenListCount.value = count

      if (column.value.uidt === UITypes.Links) {
        cur.row[colTitle] = count
      } else {
        const unlinkIds = new Set(queue.filter((o) => o.columnId === colId && o.op === 'unlink').map((o) => o.relatedRowId))
        const linkRecords = queue.filter((o) => o.columnId === colId && o.op === 'link').map((o) => o.record)
        const baseArr = Array.isArray(base) ? base : []
        cur.row[colTitle] = [...baseArr.filter((r) => !unlinkIds.has(`${getRelatedTableRowId(r)}`)), ...linkRecords]
      }
    }

    // Match buffered related rows by their primary key — the object shape from the
    // linked list can differ from the one stored when linking, so deep-compare is unsafe.
    const isSameRelatedRow = (a: Record<string, any>, b: Record<string, any>) =>
      getRelatedTableRowId(a) === getRelatedTableRowId(b)

    // Is the given related record buffered as a pending link? New rows read ltarState;
    // existing rows read the pendingLtarOps queue (#14058).
    const isPendingLink = (relatedRow: Record<string, any>) => {
      if (isNewRow?.value) {
        const buffered = currentRow.value?.rowMeta?.ltarState?.[column.value.title!]
        if (!buffered) return false
        return Array.isArray(buffered)
          ? buffered.some((r: Record<string, any>) => isSameRelatedRow(r, relatedRow))
          : isSameRelatedRow(buffered, relatedRow)
      }
      const relId = `${getRelatedTableRowId(relatedRow)}`
      return (pendingLtarOps?.value ?? []).some(
        (o) => o.columnId === column.value.id && o.op === 'link' && o.relatedRowId === relId,
      )
    }

    // Is the given related record buffered as a pending unlink? Only existing rows have
    // persisted links to remove; the unlink lives in the pendingLtarOps queue (#14058).
    const isPendingUnlink = (relatedRow: Record<string, any>) => {
      if (isNewRow?.value) return false
      const relId = `${getRelatedTableRowId(relatedRow)}`
      return (pendingLtarOps?.value ?? []).some(
        (o) => o.columnId === column.value.id && o.op === 'unlink' && o.relatedRowId === relId,
      )
    }

    // Drop a buffered (not-yet-saved) link by related-row identity — used by the
    // pending-links section of the child list. Does NOT touch the index-keyed
    // caches (childrenCachedLinkedState / isChildrenListLinked / excludedLinkedState)
    // because a pending link has no persisted/excluded index. Mirrors link()'s
    // asymmetric counting (link only increments for multi-target).
    const removePendingLink = async (relatedRow: Record<string, any>) => {
      if (!rowStoreCurrentRow) return
      if (isNewRow?.value) {
        // New row: links live in ltarState — drop the buffered link and update display.
        if (!removeLTARRef) return
        await removeLTARRef(relatedRow, column.value as ColumnType, { skipRowDisplay: true })
        if (isSingleTargetRelation.value) {
          rowStoreCurrentRow.value.row[column.value.title!] = null
        } else {
          childrenListCount.value = Math.max(0, childrenListCount.value - 1)
          const colVal = rowStoreCurrentRow.value.row[column.value.title!]
          if (Array.isArray(colVal)) {
            const idx = colVal.findIndex((r: Record<string, any>) => getRelatedTableRowId(r) === getRelatedTableRowId(relatedRow))
            const next = [...colVal]
            if (idx !== -1) next.splice(idx, 1)
            rowStoreCurrentRow.value.row[column.value.title!] = next
          } else {
            rowStoreCurrentRow.value.row[column.value.title!] = Math.max(0, (+colVal || 0) - 1)
          }
        }
      } else {
        // Existing row: enqueue an unlink — reconcile cancels the matching queued link, and
        // refreshDeferredDisplay re-derives the count from persisted + queue (#14058).
        enqueueLtarOp('unlink', relatedRow)
        refreshDeferredDisplay()
      }
      syncPendingLinkRows()
    }

    const unlink = async (
      row: Record<string, any>,
      { metaValue = meta.value }: { metaValue?: TableType } = {},
      index: number, // Index is For Loading and Linked State of Row
    ) => {
      // Defer the unlink (persist on save) for new rows and for existing rows edited
      // inside the expanded form (#14013) — see `shouldDefer`.
      if (shouldDefer.value) {
        if (!removeLTARRef || !rowStoreCurrentRow) {
          console.warn('[useLTARStore]: unlink() called without a row-store provider — ignoring')
          return
        }

        if (isNewRow?.value || !rowId.value) {
          // New row: links live entirely in local ltarState + row.row.
          removeLTARRef(row, column.value as ColumnType)
          const targetRow = rowStoreCurrentRow.value
          if (isSingleTargetRelation.value) {
            targetRow.row[column.value.title!] = null
          } else {
            const arr = targetRow.row[column.value.title!]
            if (Array.isArray(arr)) {
              const idx = arr.indexOf(row)
              if (idx !== -1) arr.splice(idx, 1)
            }
          }
        } else {
          // Existing row in the expanded form: queue the unlink (reconcile auto-cancels a
          // matching pending link), then re-derive the cell value/count from persisted +
          // queue so the cell refreshes immediately. The actual nestedRemove runs on save
          // via applyPendingLtarOps (#14058).
          enqueueLtarOp('unlink', row)
          refreshDeferredDisplay()

          // Keep the child-list pending-links section in sync with the queue.
          syncPendingLinkRows()
        }

        isChildrenExcludedListLinked.value[index] = false
        isChildrenListLinked.value[index] = false
        excludedLinkedState.value.set(index, false)
        childrenCachedLinkedState.value.set(index, false)
        $e('a:links:unlink')
        return
      }
      try {
        // todo: audit

        if (Object.keys(currentRow.value.row).length === 0) {
          refreshCurrentRow()
        }

        childrenListOffsetCount.value = childrenListOffsetCount.value - 1
        childrenExcludedOffsetCount.value = childrenExcludedOffsetCount.value - 1

        isChildrenExcludedListLoading.value[index] = true
        isChildrenListLoading.value[index] = true
        excludedLoadingState.value.set(index, true)
        childrenCachedLoadingState.value.set(index, true)
        await $api.dbTableRow.nestedRemove(
          NOCO,
          metaValue?.base_id ?? (base.value.id as string),
          metaValue.id!,
          encodeURIComponent(rowId.value),
          type.value as RelationTypes,
          column?.value?.id,
          encodeURIComponent(getRelatedTableRowId(row) as string),
        )

        isChildrenExcludedListLinked.value[index] = false
        isChildrenListLinked.value[index] = false
        excludedLinkedState.value.set(index, false)
        childrenCachedLinkedState.value.set(index, false)
        if (!isSingleTargetRelation.value) {
          childrenListCount.value = childrenListCount.value - 1
        }

        // Mirror the new-row branch: clear the linked record from the row store so
        // BT/MO cells (which display the linked record directly off the row) refresh
        // immediately. Reload paths are no-ops in EE, so this is the only signal.
        if (isSingleTargetRelation.value && rowStoreCurrentRow) {
          rowStoreCurrentRow.value.row[column.value.title!] = null
        }
      } catch (e: any) {
        message.error(`${t('msg.error.unlinkFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      } finally {
        isChildrenExcludedListLoading.value[index] = false
        isChildrenListLoading.value[index] = false
        excludedLoadingState.value.set(index, false)
        childrenCachedLoadingState.value.set(index, false)
      }

      _reloadData?.({ shouldShowLoading: false, path: path.value })

      $e('a:links:unlink')
    }

    const link = async (
      row: Record<string, any>,
      { metaValue = meta.value }: { metaValue?: TableType } = {},
      index: number, // Index is For Loading and Linked State of Row
    ) => {
      // Defer the link (persist on save) for new rows and for existing rows edited inside
      // the expanded form (#14013) — see `shouldDefer`.
      if (shouldDefer.value) {
        if (!addLTARRef || !rowStoreCurrentRow) {
          console.warn('[useLTARStore]: link() called without a row-store provider — ignoring')
          return
        }

        if (isNewRow?.value || !rowId.value) {
          // New row: buffered links drive the cell display via row.row.
          await addLTARRef(row, column.value as ColumnType)
          const targetRow = rowStoreCurrentRow.value
          if (isSingleTargetRelation.value) {
            targetRow.row[column.value.title!] = row
          } else {
            if (!Array.isArray(targetRow.row[column.value.title!])) {
              targetRow.row[column.value.title!] = []
            }
            targetRow.row[column.value.title!].push(row)
          }
        } else {
          // Existing row in the expanded form: queue the link (reconcile auto-cancels a
          // matching pending unlink), then re-derive the cell value/count from persisted +
          // queue so the cell refreshes immediately. The actual nestedAdd runs on save via
          // applyPendingLtarOps (#14058).
          enqueueLtarOp('link', row)
          refreshDeferredDisplay()

          // Keep the child-list pending-links section in sync with the queue.
          syncPendingLinkRows()
        }

        isChildrenExcludedListLinked.value[index] = true
        isChildrenListLinked.value[index] = true
        excludedLinkedState.value.set(index, true)
        childrenCachedLinkedState.value.set(index, true)

        // Single-target: only the picked record stays linked in the excluded list.
        if (isSingleTargetRelation.value) {
          isChildrenExcludedListLinked.value = Array(childrenExcludedList.value?.list.length).fill(false)
          isChildrenExcludedListLinked.value[index] = true
          for (const [key] of excludedLinkedState.value) {
            excludedLinkedState.value.set(key, false)
          }
          excludedLinkedState.value.set(index, true)
        }

        $e('a:links:link')
        return
      }
      try {
        isChildrenExcludedListLoading.value[index] = true
        isChildrenListLoading.value[index] = true
        excludedLoadingState.value.set(index, true)
        childrenCachedLoadingState.value.set(index, true)

        childrenListOffsetCount.value = childrenListOffsetCount.value + 1
        childrenExcludedOffsetCount.value = childrenExcludedOffsetCount.value + 1

        await $api.dbTableRow.nestedAdd(
          NOCO,
          metaValue?.base_id ?? (base.value.id as string),
          metaValue.id as string,
          encodeURIComponent(rowId.value),
          type.value as RelationTypes,
          column?.value?.id,
          encodeURIComponent(getRelatedTableRowId(row) as string) as string,
        )
        // await loadChildrenList()

        isChildrenExcludedListLinked.value[index] = true
        isChildrenListLinked.value[index] = true
        excludedLinkedState.value.set(index, true)
        childrenCachedLinkedState.value.set(index, true)

        if (!isSingleTargetRelation.value) {
          childrenListCount.value = childrenListCount.value + 1
        } else {
          isChildrenExcludedListLinked.value = Array(childrenExcludedList.value?.list.length).fill(false)
          isChildrenExcludedListLinked.value[index] = true
          // Reset Map-based linked state for single-target: only the selected row is linked
          for (const [key] of excludedLinkedState.value) {
            excludedLinkedState.value.set(key, false)
          }
          excludedLinkedState.value.set(index, true)
        }

        // Mirror the new-row branch: write the picked record back to the row store so
        // BT/MO cells (which display the linked record directly off the row) refresh
        // immediately. Reload paths are no-ops in EE, so this is the only signal.
        if (isSingleTargetRelation.value && rowStoreCurrentRow) {
          rowStoreCurrentRow.value.row[column.value.title!] = row
        }
      } catch (e: any) {
        message.error(`Linking failed: ${await extractSdkResponseErrorMsg(e)}`)
      } finally {
        isChildrenExcludedListLoading.value[index] = false
        isChildrenListLoading.value[index] = false
        excludedLoadingState.value.set(index, false)
        childrenCachedLoadingState.value.set(index, false)
      }

      _reloadData?.({ shouldShowLoading: false, path: path.value })

      $e('a:links:link')
    }

    // --- Chunk-based fetch and cache eviction for virtual scroll ---

    const _fetchExcludedChunkData = async (offset: number, limit: number) => {
      const where = getWhereClause(childrenExcludedListPagination.query)

      if (isPublic.value) {
        const router = useRouter()
        const route = router.currentRoute
        let rowData
        if (isForm.value) {
          const { formState, additionalState } = useSharedFormStoreOrThrow()
          rowData = await sanitizeRowData({ ...(formState?.value || {}), ...(additionalState?.value || {}) })
        }
        return await $api.public.dataRelationList(
          route.value.params.viewId as string,
          column.value.id,
          {},
          {
            headers: { 'xc-password': sharedViewPassword.value },
            query: {
              limit,
              offset,
              where,
              fields: requiredFieldsToLoad.value,
              rowData: JSON.stringify(rowData),
            } as RequestParams,
          },
        )
      } else if (isNewRow?.value) {
        const linkRowData = await sanitizeRowData(row.value.row)
        return await $api.internal.getOperation((column.value as any).fk_workspace_id!, column.value!.base_id!, {
          operation: 'linkDataList',
          limit,
          offset,
          where,
          columnId: column.value.fk_column_id || column.value.id,
          linkRowData: JSON.stringify(linkRowData),
        })
      } else {
        let changedRowData
        try {
          if (row.value?.row) {
            changedRowData = Object.keys(row.value?.row).reduce((acc: Record<string, any>, key: string) => {
              if (row.value.row[key] !== row.value.oldRow[key]) acc[key] = row.value.row[key]
              return acc
            }, {})
            changedRowData = await sanitizeRowData(changedRowData)
          }
        } catch {}
        return await $api.dbTableRow.nestedChildrenExcludedList(
          NOCO,
          meta.value?.base_id ?? baseId,
          meta.value.id,
          encodeURIComponent(rowId.value),
          type.value,
          column?.value?.id,
          {
            limit: String(limit),
            offset: String(offset),
            where,
            linkRowData: changedRowData ? JSON.stringify(changedRowData) : undefined,
            fields: requiredFieldsToLoad.value,
          } as any,
        )
      }
    }

    const clearExcludedCache = (bufferStart: number, bufferEnd: number) => {
      if (excludedCachedRows.value.size <= MAX_CACHE_SIZE) return
      const safeStartChunk = Math.floor(bufferStart / CHUNK_SIZE)
      const safeEndChunk = Math.floor(bufferEnd / CHUNK_SIZE)
      const newMap = new Map<number, Record<string, any>>()
      const newLinked = new Map<number, boolean>()
      const newLoading = new Map<number, boolean>()
      for (const [idx, row] of excludedCachedRows.value) {
        const chunk = Math.floor(idx / CHUNK_SIZE)
        if (chunk >= safeStartChunk && chunk <= safeEndChunk) {
          newMap.set(idx, row)
          if (excludedLinkedState.value.has(idx)) newLinked.set(idx, excludedLinkedState.value.get(idx)!)
          if (excludedLoadingState.value.has(idx)) newLoading.set(idx, excludedLoadingState.value.get(idx)!)
        }
      }
      // Reset evicted chunk states
      for (let i = 0; i < excludedChunkStates.value.length; i++) {
        if (excludedChunkStates.value[i] === 'loaded' && (i < safeStartChunk || i > safeEndChunk)) {
          excludedChunkStates.value[i] = undefined
        }
      }
      excludedCachedRows.value = newMap
      excludedLinkedState.value = newLinked
      excludedLoadingState.value = newLoading
    }

    const fetchExcludedChunk = async (chunkId: number) => {
      if (excludedChunkStates.value[chunkId]) return
      const offset = chunkId * CHUNK_SIZE
      if (offset >= excludedTotalRows.value && excludedTotalRows.value > 0) return

      excludedChunkStates.value[chunkId] = 'loading'
      try {
        const result = await _fetchExcludedChunkData(offset, CHUNK_SIZE)
        if (result?.list) {
          result.list.forEach((item: Record<string, any>, i: number) => {
            excludedCachedRows.value.set(offset + i, item)
            excludedLinkedState.value.set(offset + i, false)
            excludedLoadingState.value.set(offset + i, false)
          })
        }
        if (result?.pageInfo?.totalRows != null) {
          excludedTotalRows.value = +result.pageInfo.totalRows
        }
        excludedChunkStates.value[chunkId] = 'loaded'
      } catch (e: any) {
        excludedChunkStates.value[chunkId] = undefined
        console.error(`Error fetching excluded chunk ${chunkId}:`, e)
      }
    }

    const resetExcludedCache = () => {
      excludedCachedRows.value = new Map()
      excludedLinkedState.value = new Map()
      excludedLoadingState.value = new Map()
      excludedChunkStates.value = []
      excludedTotalRows.value = 0
    }

    // --- Children (linked items) cache ---

    const _fetchChildrenChunkData = async (offset: number, limit: number) => {
      const where = getWhereClause(childrenListPagination.query)

      if (isNewRow?.value || !rowId.value) {
        // Client-side filtering for new rows
        const colTitle = column.value?.title || ''
        const rawList = newRowState.state?.[colTitle] ?? []
        const query = childrenListPagination.query.toLocaleLowerCase()
        const list = query
          ? rawList.filter((record: Record<string, any>) =>
              `${record[relatedTableDisplayValueProp.value] ?? ''}`.toLocaleLowerCase().includes(query),
            )
          : rawList
        return {
          list: list.slice(offset, offset + limit),
          pageInfo: { totalRows: list.length },
        }
      } else if (isPublic.value) {
        return await $api.public.dataNestedList(
          sharedView.value?.uuid as string,
          encodeURIComponent(rowId.value),
          type.value as RelationTypes,
          column.value.id,
          { limit: String(limit), offset: String(offset), where } as any,
          { headers: { 'xc-password': sharedViewPassword.value } },
        )
      } else {
        return await $api.dbTableRow.nestedList(
          NOCO,
          meta.value?.base_id ?? ((base?.value?.id || (sharedView.value?.view as any)?.base_id) as string),
          meta.value.id,
          encodeURIComponent(rowId.value),
          type.value as RelationTypes,
          column?.value?.id,
          { limit: String(limit), offset: String(offset), where, fields: requiredFieldsToLoad.value } as any,
        )
      }
    }

    const clearChildrenCache = (bufferStart: number, bufferEnd: number) => {
      if (childrenCachedRows.value.size <= MAX_CACHE_SIZE) return
      const safeStartChunk = Math.floor(bufferStart / CHUNK_SIZE)
      const safeEndChunk = Math.floor(bufferEnd / CHUNK_SIZE)
      const newMap = new Map<number, Record<string, any>>()
      const newLinked = new Map<number, boolean>()
      const newLoading = new Map<number, boolean>()
      for (const [idx, row] of childrenCachedRows.value) {
        const chunk = Math.floor(idx / CHUNK_SIZE)
        if (chunk >= safeStartChunk && chunk <= safeEndChunk) {
          newMap.set(idx, row)
          if (childrenCachedLinkedState.value.has(idx)) newLinked.set(idx, childrenCachedLinkedState.value.get(idx)!)
          if (childrenCachedLoadingState.value.has(idx)) newLoading.set(idx, childrenCachedLoadingState.value.get(idx)!)
        }
      }
      for (let i = 0; i < childrenChunkStates.value.length; i++) {
        if (childrenChunkStates.value[i] === 'loaded' && (i < safeStartChunk || i > safeEndChunk)) {
          childrenChunkStates.value[i] = undefined
        }
      }
      childrenCachedRows.value = newMap
      childrenCachedLinkedState.value = newLinked
      childrenCachedLoadingState.value = newLoading
    }

    const fetchChildrenChunk = async (chunkId: number) => {
      if (childrenChunkStates.value[chunkId]) return
      const offset = chunkId * CHUNK_SIZE
      if (offset >= childrenCachedTotalRows.value && childrenCachedTotalRows.value > 0) return

      childrenChunkStates.value[chunkId] = 'loading'
      try {
        const result = await _fetchChildrenChunkData(offset, CHUNK_SIZE)
        if (result?.list) {
          result.list.forEach((item: Record<string, any>, i: number) => {
            childrenCachedRows.value.set(offset + i, item)
            childrenCachedLinkedState.value.set(offset + i, true)
            childrenCachedLoadingState.value.set(offset + i, false)
          })
        }
        if (result?.pageInfo?.totalRows != null) {
          childrenCachedTotalRows.value = +result.pageInfo.totalRows
        }
        childrenChunkStates.value[chunkId] = 'loaded'
      } catch (e: any) {
        childrenChunkStates.value[chunkId] = undefined
        console.error(`Error fetching children chunk ${chunkId}:`, e)
      }
    }

    const resetChildrenCache = () => {
      childrenCachedRows.value = new Map()
      childrenCachedLinkedState.value = new Map()
      childrenCachedLoadingState.value = new Map()
      childrenChunkStates.value = []
      childrenCachedTotalRows.value = 0
      pendingLinkRows.value = []
    }

    const debounceLoadChildrenExcludedList = useDebounceFn(loadChildrenExcludedList, 500)

    const debounceLoadChildrenList = useDebounceFn(loadChildrenList, 500)

    // watchers — only trigger on query change. The legacy loaders also seed
    // chunk 0 of the virtual-scroll cache so a single API call covers both
    // the legacy ref consumers (count, Enter-key, isLinked, expanded form)
    // and the virtualized dropdown.
    watch(
      () => childrenExcludedListPagination.query,
      async () => {
        childrenExcludedListPagination.page = 1
        resetExcludedCache()
        await debounceLoadChildrenExcludedList(newRowState.state)
      },
    )

    watch(
      () => childrenListPagination.query,
      async () => {
        childrenListPagination.page = 1
        resetChildrenCache()
        await debounceLoadChildrenList(false, newRowState.state)
      },
    )

    watch(childrenList, async () => {
      if (ncIsArray(childrenList.value?.list)) {
        childrenList.value.list.forEach((row: Record<string, any>, index: number) => {
          isChildrenListLinked.value[index] = true
          isChildrenListLoading.value[index] = false
        })
      }
    })

    const resetChildrenExcludedOffsetCount = () => {
      childrenExcludedOffsetCount.value = 0
    }

    const resetChildrenListOffsetCount = () => {
      childrenListOffsetCount.value = 0
    }

    // Per-link ordering (v2 mm on Postgres): the NocoDB-managed junction carries
    // a per-direction Order column, so linked records can be manually arranged.
    // Only surfaced when the junction actually has the order column
    // (`fk_mm_child_order_column_id`) AND the source is Postgres — the ordered
    // read is PG-only, so reordering elsewhere would be a confusing no-op.
    const canReorder = computed(
      () =>
        type.value === RelationTypes.MANY_TO_MANY &&
        !!(colOptions.value as any)?.fk_mm_child_order_column_id &&
        isPg(meta.value?.source_id),
    )

    // Move `movedRow` before `beforeRow` (both related-table rows), or to the end
    // when `beforeRow` is null. Extracts the related-table PKs and calls the
    // per-link reorder endpoint, then reloads the child list so the new order is
    // reflected. No-op unless `canReorder` (v2 mm on Postgres).
    const reorderLink = async (
      movedRow: Record<string, any>,
      beforeRow: Record<string, any> | null = null,
      { metaValue = meta.value }: { metaValue?: TableType } = {},
    ) => {
      if (!rowId.value || !column.value?.id) return

      const refRowId = getRelatedTableRowId(movedRow)
      if (refRowId === undefined || refRowId === null) return
      const before = beforeRow ? getRelatedTableRowId(beforeRow) ?? null : null

      // Route through the internal-operations API — the same channel row reorder
      // (`dataMove`) uses — rather than the public `/api/v2/tables` REST family,
      // which isn't exposed to the app on EE/cloud deployments (there the GUI
      // reaches data via `/api/v1/db/data` and meta via `/api/v2/internal`).
      await $api.internal.postOperation(
        (metaValue as any)?.fk_workspace_id,
        metaValue?.base_id as string,
        {
          operation: 'nestedDataReorder',
          tableId: metaValue?.id,
          columnId: column.value.id,
          rowId: rowId.value,
          refRowId,
          before,
        } as any,
        undefined,
      )

      $e('a:links:reorder')
      await loadChildrenList()
    }

    return {
      canReorder,
      reorderLink,
      getRelatedTableRowId,
      relatedTableMeta,
      isLinkedTableAccessible,
      loadRelatedTableMeta,
      targetViewColumns,
      targetViewColumnsById,
      relatedTableDisplayValueProp,
      displayValueTypeAndFormatProp,
      childrenExcludedList,
      childrenList,
      childrenListCount,
      childrenListOffsetCount,
      childrenExcludedOffsetCount,
      rowId,
      childrenExcludedListPagination,
      childrenListPagination,
      displayValueProp,
      meta,
      unlink,
      link,
      loadChildrenExcludedList,
      loadChildrenList,
      isChildrenExcludedListLinked,
      isChildrenListLinked,
      isChildrenListLoading,
      isChildrenExcludedListLoading,
      row,
      isChildrenLoading,
      isChildrenExcludedLoading,
      deleteRelatedRow,
      getRelatedTableRowId,
      headerDisplayValue,
      relatedTableDisplayValueColumn,
      relatedTableDisplayValuePropId,
      resetChildrenExcludedOffsetCount,
      resetChildrenListOffsetCount,
      attachmentCol,
      fields,
      refreshCurrentRow,
      externalBaseUserRoles,
      showExtraFields,
      // Chunked cache for virtual scroll
      CHUNK_SIZE,
      MAX_CACHE_SIZE,
      ROW_HEIGHT,
      excludedCachedRows,
      excludedTotalRows,
      excludedChunkStates,
      excludedLinkedState,
      excludedLoadingState,
      fetchExcludedChunk,
      clearExcludedCache,
      resetExcludedCache,
      childrenCachedRows,
      childrenCachedTotalRows,
      childrenChunkStates,
      childrenCachedLinkedState,
      childrenCachedLoadingState,
      fetchChildrenChunk,
      clearChildrenCache,
      resetChildrenCache,
      // Deferred (unsaved) links surfaced in the child-list modal
      shouldDefer,
      isSingleTargetRelation,
      pendingLinkRows,
      pendingUnlinkRows,
      removePendingLink,
      isPendingLink,
      isPendingUnlink,
    }
  },
  'ltar-store',
)

export { useProvideLTARStore }

export function useLTARStoreOrThrow() {
  const ltarStore = useLTARStore()
  if (ltarStore == null) throw new Error('Please call `useLTARStore` on the appropriate parent component')
  return ltarStore
}
