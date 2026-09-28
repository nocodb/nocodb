import type {
  ButtonType,
  ColumnType,
  GridColumnReqType,
  GridColumnType,
  GridType,
  ListType,
  MapType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { CommonAggregations, ViewTypes, getFirstNonPersonalView, isHiddenCol, isSystemColumn } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { InterfacePageDataApi } from '../lib/interfaceData'

const [useProvideViewColumns, useViewColumns] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    reloadData?: (params?: { shouldShowLoading?: boolean }) => void,
    isPublic = false,
    /**
     * Interface-page data adapter. Normally resolved via `InterfacePageDataInj`,
     * but the interface wrapper both provides that token AND calls this
     * provider from the same component instance — and `inject()` can't see a
     * same-instance `provide()` — so it must pass the adapter explicitly.
     */
    interfaceDataApiParam?: InterfacePageDataApi,
  ) => {
    const rootFields = ref<ColumnType[]>([])

    const fields = ref<Field[]>()

    const fieldsMap = computed(() =>
      (fields.value || []).reduce<Record<string, any>>((acc, curr) => {
        if (curr.fk_column_id) {
          acc[curr.fk_column_id] = curr
        }
        return acc
      }, {}),
    )

    const filterQuery = ref('')

    const { $api, $e, $eventBus } = useNuxtApp()

    // Coalesce the on-mount view-metadata reads (viewColumnList et al.)
    // into a single `batch` envelope — view-init used to fire 5+ separate
    // HTTP requests.
    const { internalGet } = useInternalBatch()

    const { getMeta: _getMeta, getMetaByKey: _getMetaByKey } = useMetas()

    const { t } = useI18n()

    const { isUIAllowed } = useRoles()

    const { isSharedBase } = storeToRefs(useBase())

    /**
     * Present when mounted inside an interface page. The view is synthetic (no
     * persisted view columns), so header resize / drag-reorder persist into the
     * viz config through the adapter instead — the source table's own grid
     * views are never written.
     */
    const interfaceDataApi = interfaceDataApiParam ?? inject(InterfacePageDataInj, undefined)

    const viewStore = useViewsStore()

    const { views } = storeToRefs(viewStore)

    const isDefaultView = computed(() => {
      return (
        getFirstNonPersonalView(views.value, {
          includeViewType: ViewTypes.GRID,
        })?.id === view.value?.id
      )
    })

    const isViewColumnsLoading = ref(true)

    const hidingViewColumnsMap = ref<Record<string, boolean>>({})

    const { hasPersonalViewPermission } = usePersonalViewPermissions(view)

    const canEditViewFields = hasPersonalViewPermission('viewFieldEdit')

    const isLocalMode = computed(() => isPublic || !canEditViewFields.value || isSharedBase.value)

    const hasViewFieldDataEditPermission = computed(() => isUIAllowed('viewFieldDataEdit'))

    const canUpdateViewMeta = hasPersonalViewPermission('viewCreateOrEdit')

    const localChanges = ref<Record<string, Field>>({})

    const isColumnViewEssential = (column: ColumnType) => {
      // TODO: consider at some point ti delegate this via a cleaner design pattern to view specific check logic
      // which could be inside of a view specific helper class (and generalized via an interface)
      // (on the other hand, the logic complexity is still very low atm - might be overkill)
      return view.value?.type === ViewTypes.MAP && (view.value?.view as MapType)?.fk_geo_data_col_id === column.id
    }

    const metaColumnById = computed<Record<string, ColumnType>>(() => {
      const result: Record<string, ColumnType> = {}

      for (const col of (meta.value?.columns || []) as ColumnType[]) {
        if (col.id) result[col.id] = col
      }

      // Include level table columns for list views (from shared metas cache)
      if (view.value?.type === ViewTypes.LIST) {
        const levels = (view.value?.view as ListType)?.levels || []
        for (const level of levels) {
          if (level.fk_model_id && level.fk_model_id !== meta.value?.id) {
            const tableMeta = _getMetaByKey(meta.value?.base_id, level.fk_model_id)
            if (tableMeta?.columns) {
              for (const col of tableMeta.columns as ColumnType[]) {
                if (col.id) result[col.id] = col
              }
            }
          }
        }
      }

      return result
    })

    const gridViewCols = ref<Record<string, GridColumnType>>({})

    const loadViewColumns = async () => {
      if (!meta.value || !view.value?.id) return

      let order = 1

      const data =
        ((isPublic
          ? meta.value?.columns
          : (
              await internalGet(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
                operation: 'viewColumnList',
                viewId: view.value.id,
              })
            ).list) as any[]) ?? []

      const fieldById = data.reduce<Record<string, any>>((acc, curr) => {
        // If hide column api is in progress and we try to load columns before that then we need to assign local visibility state
        curr.show = hidingViewColumnsMap.value[curr.fk_column_id] && !!curr.show ? false : !!curr.show

        return {
          ...acc,
          [curr.fk_column_id]: curr,
        }
      }, {})

      // For list views with levels, ensure metas for non-root level tables are loaded
      if (view.value?.type === ViewTypes.LIST) {
        const levels = (view.value?.view as ListType)?.levels || []

        for (const level of levels) {
          if (level.fk_model_id && level.fk_model_id !== meta.value?.id) {
            try {
              await _getMeta(meta.value!.base_id!, level.fk_model_id)
            } catch (e) {
              // silently ignore — level table meta may not be accessible
            }
          }
        }
      }

      // Build combined columns: root table + level tables (for list views)
      const allTableColumns: { column: ColumnType; tableMeta: TableType }[] = (meta.value?.columns || []).map(
        (col: ColumnType) => ({
          column: col,
          tableMeta: meta.value!,
        }),
      )

      if (view.value?.type === ViewTypes.LIST) {
        const levels = (view.value?.view as ListType)?.levels || []
        // Track existing column IDs to avoid duplicates
        // (public views already include level columns in meta.value?.columns)
        const existingColIds = new Set(allTableColumns.map(({ column }) => column.id))
        for (const level of levels) {
          if (level.fk_model_id && level.fk_model_id !== meta.value?.id) {
            const tableMeta = _getMetaByKey(meta.value?.base_id, level.fk_model_id)
            if (tableMeta?.columns) {
              for (const col of tableMeta.columns as ColumnType[]) {
                if (!existingColIds.has(col.id)) {
                  allTableColumns.push({ column: col, tableMeta })
                  existingColIds.add(col.id)
                }
              }
            }
          }
        }
      }

      fields.value = allTableColumns
        .filter(({ column, tableMeta }) => {
          // filter created by and last modified by system columns
          if (isHiddenCol(column, tableMeta)) return false
          return true
        })
        .map(({ column }) => {
          const currentColumnField = fieldById[column.id!] || {}

          return {
            title: column.title,
            fk_column_id: column.id,
            ...currentColumnField,
            show: currentColumnField.show || isColumnViewEssential(currentColumnField),
            order: currentColumnField.order || order++,
            aggregation: currentColumnField?.aggregation ?? CommonAggregations.None,
            system: isSystemColumn(metaColumnById?.value?.[currentColumnField.fk_column_id!]),
            isViewEssentialField: isColumnViewEssential(column),
            initialShow:
              currentColumnField.show ||
              isColumnViewEssential(currentColumnField) ||
              (currentColumnField as GridColumnType)?.group_by,
          }
        })
        .sort((a: Field, b: Field) => a.order - b.order)

      if (isLocalMode.value && fields.value) {
        for (const key in localChanges.value) {
          const fieldIndex = fields.value.findIndex((f) => f.fk_column_id === key)
          if (fieldIndex !== undefined && fieldIndex > -1) {
            fields.value[fieldIndex] = localChanges.value[key]
            fields.value = fields.value.sort((a: Field, b: Field) => a.order - b.order)
          }
        }
      }

      // Use fields columns to populate gridViewCols
      gridViewCols.value = fields.value.reduce<Record<string, GridColumnType>>(
        (o, col) => ({
          ...o,
          [col.fk_column_id as string]: col,
        }),
        {},
      )
    }

    const updateDefaultViewColumnMeta = async (
      columnId?: string,
      colMeta: { defaultViewColOrder?: number; defaultViewColVisibility?: boolean } = {},
      allFields = false,
    ) => {
      if (!meta.value?.columns) return

      for (const c of meta.value.columns) {
        if (!allFields && c.id !== columnId) continue
        if (allFields && c.pv) continue
        c.meta = { ...parseProp(c.meta || {}), ...colMeta }
      }

      if (!allFields && columnId && meta.value?.columnsById?.[columnId]) {
        meta.value.columnsById[columnId].meta = {
          ...parseProp(meta.value.columnsById[columnId].meta),
          ...colMeta,
        }
      }

      if (allFields) {
        meta.value.columnsById = meta.value.columns.reduce((acc, c) => {
          acc[c.id!] = c
          return acc
        }, {} as Record<string, ColumnType>)
      }
    }

    const showAll = async (ignoreIds?: any, levelId?: string) => {
      if (isLocalMode.value) {
        const fieldById = (fields.value || []).reduce<Record<string, any>>((acc, curr) => {
          if (curr.fk_column_id) {
            curr.show = !!curr.initialShow
            acc[curr.fk_column_id] = curr
          }
          return acc
        }, {})

        fields.value = (fields.value || [])?.map((field: Field) => {
          const updateField = {
            ...field,
            show: fieldById[field.fk_column_id!]?.show,
          }
          localChanges.value[field.fk_column_id!] = field
          return updateField
        })

        meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
          if (fieldById[column.id!]) {
            return {
              ...column,
              ...fieldById[column.id!],
              id: fieldById[column.id!].fk_column_id,
            }
          }
          return column
        })

        reloadData?.()
        return
      }

      // Captured before the fields land, to compare against the region afterwards
      const frozenIdsBefore = frozenFieldIdsSnapshot()

      if (view?.value?.id) {
        await $api.internal.postOperation(view.value.fk_workspace_id!, view.value.base_id!, {
          operation: 'showAllColumns',
          viewId: view.value.id,
          ...(ignoreIds ? { ignoreIds } : {}),
          ...(levelId ? { levelId } : {}),
        })

        if (isDefaultView.value) {
          updateDefaultViewColumnMeta(undefined, { defaultViewColVisibility: true }, true)
        }
      }

      await loadViewColumns()
      await preserveFrozenFields(frozenIdsBefore)
      reloadData?.()
      $e('a:fields:show-all')
    }

    const hideAll = async (ignoreIds?: any, levelId?: string) => {
      if (isLocalMode.value) {
        const fieldById = (fields.value || []).reduce<Record<string, any>>((acc, curr) => {
          if (curr.fk_column_id) {
            curr.show = !!metaColumnById?.value?.[curr.fk_column_id!]?.pv || !!curr.isViewEssentialField
            acc[curr.fk_column_id] = curr
          }
          return acc
        }, {})

        fields.value = (fields.value || [])?.map((field: Field) => {
          const updateField = {
            ...field,
            show: fieldById[field.fk_column_id!]?.show,
          }
          localChanges.value[field.fk_column_id!] = field
          return updateField
        })

        meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
          if (fieldById[column.id!]) {
            return {
              ...column,
              ...fieldById[column.id!],
              id: fieldById[column.id!].fk_column_id,
            }
          }
          return column
        })

        reloadData?.()
        return
      }
      if (view?.value?.id) {
        await $api.internal.postOperation(view.value.fk_workspace_id!, view.value.base_id!, {
          operation: 'hideAllColumns',
          viewId: view.value.id,
          ...(ignoreIds ? { ignoreIds } : {}),
          ...(levelId ? { levelId } : {}),
        })

        if (isDefaultView.value) {
          updateDefaultViewColumnMeta(undefined, { defaultViewColVisibility: false }, true)
        }

        // Only the display value stays visible — collapse the frozen region with it
        if (canAdjustFrozenFields() && currentFrozenCount() > 1) {
          await writeFrozenCount(1)
        }
      }

      await loadViewColumns()
      reloadData?.()
      $e('a:fields:show-all')
    }

    const applyVisibilityLocally = (field: any, index: number, updateDefaultViewColMeta = false) => {
      if (isLocalMode.value && fields.value) {
        fields.value[index] = field
        meta.value!.columns = meta.value!.columns?.map((column: ColumnType) => {
          if (column.id === field.fk_column_id) {
            return {
              ...column,
              ...field,
              id: field.fk_column_id,
            }
          }
          return column
        })

        localChanges.value[field.fk_column_id] = field
      }

      if (updateDefaultViewColMeta && canEditViewFields.value && field.id) {
        updateDefaultViewColumnMeta(field.fk_column_id, {
          defaultViewColOrder: field.order,
          defaultViewColVisibility: field.show,
        })
      }
    }

    const buildVisibilityEntry = (field: any) => {
      if (!field.id || !view.value?.id) return null
      if (isLocalMode.value || !canEditViewFields.value) return null
      const column: Record<string, unknown> = {}
      if ('show' in field) column.show = field.show
      if ('order' in field) column.order = field.order
      if ('underline' in field) column.underline = field.underline
      if ('bold' in field) column.bold = field.bold
      if ('italic' in field) column.italic = field.italic
      return { viewId: view.value.id, columnId: field.id, column }
    }

    const saveOrUpdate = async (field: any, index: number, disableDataReload = false, updateDefaultViewColMeta = false) => {
      applyVisibilityLocally(field, index, updateDefaultViewColMeta)

      if (canEditViewFields.value) {
        if (field.id && view?.value?.id) {
          const body: Record<string, unknown> = {}
          if ('show' in field) body.show = field.show
          if ('order' in field) body.order = field.order
          if ('underline' in field) body.underline = field.underline
          if ('bold' in field) body.bold = field.bold
          if ('italic' in field) body.italic = field.italic

          await $api.internal.postOperation(
            meta.value!.fk_workspace_id!,
            meta.value!.base_id!,
            {
              operation: 'viewColumnUpdate',
              viewId: view.value.id,
              columnId: field.id,
            },
            body,
          )
        } else if (view.value?.id) {
          const insertedField = (await $api.internal.postOperation(
            meta.value!.fk_workspace_id!,
            meta.value!.base_id!,
            {
              operation: 'viewColumnCreate',
              viewId: view.value.id,
            },
            field,
          )) as any

          /** update the field in fields if defined */
          if (fields.value) fields.value[index] = insertedField

          return insertedField
        }
      }

      if (!disableDataReload) {
        await loadViewColumns()
        reloadData?.({ shouldShowLoading: false })
      }
    }

    const showSystemFields = computed({
      get() {
        return (view.value?.show_system_fields as boolean) || false
      },
      set(v: boolean) {
        if (view?.value?.id) {
          const currentValue = (view.value.show_system_fields as boolean) || false
          if (currentValue === v) return

          if (!isLocalMode.value) {
            $api.internal
              .postOperation(
                view.value.fk_workspace_id!,
                view.value.base_id!,
                {
                  operation: 'viewUpdate',
                  viewId: view.value.id,
                },
                {
                  show_system_fields: v,
                },
              )
              .finally(() => {
                loadViewColumns()
                reloadData?.()
              })
          }
          view.value.show_system_fields = v
        }
        $e('a:fields:system-fields')
      },
    })

    const fieldSearchBasisOptions: {
      searchBasisInfo: string
      filterCallback: (query: string, option: ColumnType) => boolean
    }[] = [
      {
        searchBasisInfo: t('msg.info.matchedByButtonLabel'),
        filterCallback: (query, option) => {
          if (!option) return false

          const column = option as ColumnType

          return isButton(column) && searchCompare([(column.colOptions as ButtonType)?.label], query)
        },
      },
      {
        searchBasisInfo: t('msg.info.matchedByFieldDescription'),
        filterCallback: (query, option) => {
          if (!option) return false

          const column = option as ColumnType

          if (!column.description) return false

          return searchCompare([column.description], query)
        },
      },
    ]

    const searchBasisIdMap = ref<Record<string, string>>({})

    /**
     * Apply search basis filter to the column
     * @param column - The column to apply the search basis filter to
     * @returns true if the column matches the search basis filter, false otherwise
     */
    const applySearchBasisFilter = (column?: ColumnType) => {
      if (!column) return false

      for (const basisOption of fieldSearchBasisOptions) {
        if (!basisOption.filterCallback(filterQuery.value, column)) continue

        searchBasisIdMap.value[column.id!] = basisOption.searchBasisInfo
        return true
      }

      return false
    }

    const filteredFieldList = computed(() => {
      searchBasisIdMap.value = {}

      return (fields.value || []).filter((field: Field) => {
        if (!field.initialShow && isLocalMode.value && !hasViewFieldDataEditPermission.value) {
          return false
        }
        const column = metaColumnById?.value?.[field.fk_column_id!]

        if (column?.pv) {
          // Step 1: Apply default filter
          if (!filterQuery.value || searchCompare([field.title], filterQuery.value)) return true

          // Step 2: Apply search basis options if default filter fails
          return applySearchBasisFilter(column)
        }

        // hide system columns if not enabled
        if (!showSystemFields.value && isSystemColumn(column)) {
          return false
        }

        // Step 1: Apply default filter
        if (!filterQuery.value || searchCompare([field.title], filterQuery.value)) return true

        // Step 2: Apply search basis options if default filter fails
        return applySearchBasisFilter(column)
      })
    })

    const numberOfHiddenFields = computed(() => {
      return (fields.value || [])
        ?.filter((field: Field) => {
          if (!field.initialShow && isLocalMode.value && !hasViewFieldDataEditPermission.value) {
            return false
          }

          if (metaColumnById?.value?.[field.fk_column_id!]?.pv) {
            return true
          }

          // hide system columns if not enabled
          if (!showSystemFields.value && isSystemColumn(metaColumnById?.value?.[field.fk_column_id!])) {
            return false
          }

          return true
        })
        .filter((field) => !field.show)?.length
    })

    const sortedAndFilteredFields = computed<ColumnType[]>(() => {
      return (fields?.value
        ?.filter((field: Field) => {
          // hide system columns if not enabled
          if (
            !showSystemFields.value &&
            metaColumnById.value &&
            metaColumnById?.value?.[field.fk_column_id!] &&
            isSystemColumn(metaColumnById.value?.[field.fk_column_id!]) &&
            !metaColumnById.value?.[field.fk_column_id!]?.pv
          ) {
            return false
          }
          return field.show && metaColumnById?.value?.[field.fk_column_id!]
        })
        ?.sort((a: Field, b: Field) => a.order - b.order)
        ?.map((field: Field) => metaColumnById?.value?.[field.fk_column_id!]) || []) as ColumnType[]
    })

    function canAdjustFrozenFields() {
      return view.value?.type === ViewTypes.GRID && !!view.value?.id && !isLocalMode.value && canEditViewFields.value
    }

    function currentFrozenCount() {
      return clampFrozenFieldCount(parseProp((view.value?.view as GridType)?.meta)?.frozen_column_count)
    }

    function fieldOrderOf(colId?: string) {
      return (fields.value || []).find((f) => f.fk_column_id === colId)?.order ?? 0
    }

    /**
     * The frozen region: the first `count` visible fields in canvas order
     * (display value hoisted first, then by order). `alsoVisibleIds` re-adds
     * fields whose local `show` the caller already flipped off optimistically.
     */
    function frozenRegionFieldIds(count: number, alsoVisibleIds: string[] = []) {
      const cols = [...sortedAndFilteredFields.value]

      for (const id of alsoVisibleIds) {
        const col = metaColumnById.value?.[id]
        if (col && !cols.some((c) => c.id === id)) cols.push(col)
      }

      return cols
        .sort((a, b) => Number(!!b.pv) - Number(!!a.pv) || fieldOrderOf(a.id) - fieldOrderOf(b.id))
        .slice(0, count)
        .map((c) => c.id!)
    }

    /** Never throws — a failed count write must not roll back the visibility change that triggered it. */
    async function writeFrozenCount(count: number) {
      try {
        const gridMeta = parseProp((view.value?.view as GridType)?.meta)

        await viewStore.updateViewMeta(view.value!.id!, ViewTypes.GRID, {
          meta: { ...gridMeta, frozen_column_count: count },
        })
      } catch (e) {
        message.error(t('msg.error.errorWhileUpdatingView'))
      }
    }

    /** Frozen field ids as they stand now; empty when there is nothing to preserve. */
    function frozenFieldIdsSnapshot() {
      if (!canAdjustFrozenFields()) return []

      const frozenCount = currentFrozenCount()

      return frozenCount > 1 ? frozenRegionFieldIds(frozenCount) : []
    }

    /**
     * Frozen membership is positional, so un-hiding fields can pull ones the user
     * never froze into the region. Shrink the count to the leading run that was
     * already frozen.
     */
    async function preserveFrozenFields(frozenIdsBefore: string[]) {
      if (frozenIdsBefore.length < 2 || !canAdjustFrozenFields()) return

      const frozenCount = currentFrozenCount()
      const frozenNow = frozenRegionFieldIds(frozenCount)

      let preserved = 0
      while (preserved < frozenNow.length && frozenIdsBefore.includes(frozenNow[preserved]!)) preserved++

      if (preserved < frozenCount) await writeFrozenCount(Math.max(1, preserved))
    }

    /**
     * Grid frozen fields (`frozen_column_count` in grid view meta = first N
     * visible fields, display value hoisted first). Visibility toggles keep the
     * count coherent:
     * - hiding a frozen field shrinks the count (the region must not swallow
     *   the next scrollable field)
     * - re-showing a field whose order falls inside the frozen region moves it
     *   to the first non-frozen slot instead of silently freezing it
     */
    const adjustFrozenFieldsOnVisibilityChange = async (columnId?: string, shown?: boolean) => {
      if (!columnId || !canAdjustFrozenFields()) return

      const frozenCount = currentFrozenCount()

      const toggledField = (fields.value || []).find((f) => f.fk_column_id === columnId)
      if (!toggledField || metaColumnById.value?.[columnId]?.pv) return

      // Visible fields in canvas order (display value first, then by order), excluding the toggled one
      const visibleOthers = [...sortedAndFilteredFields.value]
        .filter((c) => c.id !== columnId)
        .sort((a, b) => Number(!!b.pv) - Number(!!a.pv))

      // Index the toggled field held (hide) or would take (show) among visible fields
      const toggledOrder = toggledField.order ?? Number.POSITIVE_INFINITY
      const index = visibleOthers.filter((c) => !!c.pv || fieldOrderOf(c.id) < toggledOrder).length

      if (index >= frozenCount) return

      if (!shown) {
        if (frozenCount <= 1) return
        await writeFrozenCount(frozenCount - 1)
        return
      }

      // No non-frozen slot exists — the field legitimately joins the frozen region
      if (visibleOthers.length < frozenCount) return

      const prevOrder = fieldOrderOf(visibleOthers[frozenCount - 1]?.id)
      const nextCol = visibleOthers[frozenCount]
      toggledField.order = nextCol ? (prevOrder + fieldOrderOf(nextCol.id)) / 2 : prevOrder + 1

      // The column menu shows a field by posting `show: true` without touching the
      // local field, so this order write must not carry a stale `show: false`.
      toggledField.show = true

      const fieldIndex = (fields.value || []).findIndex((f) => f.fk_column_id === columnId)

      try {
        await saveOrUpdate(toggledField, fieldIndex, true, isDefaultView.value)
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    /**
     * Bulk-hide counterpart — one count write for the whole gesture. `columnIds`
     * are the fields just hidden; their local `show` is already false, so they are
     * re-added when reconstructing the region they used to sit in.
     */
    const adjustFrozenFieldsOnBulkHide = async (columnIds: string[]) => {
      if (!columnIds.length || !canAdjustFrozenFields()) return

      const frozenCount = currentFrozenCount()
      if (frozenCount <= 1) return

      const hiddenFrozenCount = frozenRegionFieldIds(frozenCount, columnIds).filter((id) => columnIds.includes(id)).length
      if (!hiddenFrozenCount) return

      await writeFrozenCount(Math.max(1, frozenCount - hiddenFrozenCount))
    }

    const toggleFieldVisibility = async (checked: boolean, field: any) => {
      const fieldIndex = fields.value?.findIndex((f) => f.fk_column_id === field.fk_column_id)

      if (!fieldIndex && fieldIndex !== 0) return
      await saveOrUpdate(field, fieldIndex, !checked, isDefaultView.value)
      await adjustFrozenFieldsOnVisibilityChange(field.fk_column_id, checked)
    }

    const toggleFieldStyles = (field: any, style: 'underline' | 'bold' | 'italic', status: boolean) => {
      const fieldIndex = fields.value?.findIndex((f) => f.fk_column_id === field.fk_column_id)
      if (!fieldIndex && fieldIndex !== 0) return
      field[style] = status
      $e('a:fields:style', { style, status })
      saveOrUpdate(field, fieldIndex, true)
    }

    // reload view columns when active view changes
    // or when columns changes(delete/add)
    watch(
      [() => view?.value?.id, () => meta.value?.columns],
      async ([newViewId], [oldViewId]) => {
        // If we change view, we need to reset the hidingViewColumnsMap
        if (oldViewId && oldViewId !== newViewId) {
          hidingViewColumnsMap.value = {}
        }

        if (!ncIsEmptyArray(hidingViewColumnsMap.value) && Object.values(hidingViewColumnsMap.value).some((v) => v)) return

        // reload only if view belongs to current table
        if (newViewId && view.value?.fk_model_id === meta.value?.id) {
          isViewColumnsLoading.value = true
          try {
            await loadViewColumns()
          } catch (e) {
            console.error(e)
          }
          isViewColumnsLoading.value = false
        }
      },
      { immediate: true },
    )

    const resizingColOldWith = ref('180px')

    /**
     * Interface mount: the synthetic view has no view-column rows to write, so a
     * header resize / drag-reorder is persisted into the viz config instead.
     * Builder edit mode only — a viewer's gesture stays session-local, like the
     * runtime row-height pick.
     */
    function persistInterfaceGridColumn(id: string, props: Partial<GridColumnReqType>) {
      if (!interfaceDataApi?.canConfigureFields?.value) return

      if (props.width) interfaceDataApi.setFieldWidth?.(id, props.width)

      // The dragged column's `order` is fractional (dropped between its two new
      // neighbours) and lives only on the in-memory columns — resolve it to the
      // shown ids in their new order, which is what the config stores.
      if ('order' in props) {
        interfaceDataApi.setFieldOrder?.(
          Object.values(gridViewCols.value)
            .filter((col) => col.show && col.fk_column_id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((col) => col.fk_column_id!),
        )
      }
    }

    const updateGridViewColumn = async (id: string, props: Partial<GridColumnReqType>) => {
      try {
        // sync with server if allowed
        if (!isPublic && canEditViewFields.value && gridViewCols.value[id]?.id) {
          const colId = gridViewCols.value[id].id

          // Route to the correct backend operation based on view type
          const operationParams =
            view.value?.type === ViewTypes.TIMELINE
              ? { operation: 'timelineColumnUpdate' as const, timelineViewColumnId: colId }
              : view.value?.type === ViewTypes.LIST
              ? { operation: 'listColumnUpdate' as const, listViewColumnId: colId }
              : view.value?.type === ViewTypes.GANTT
              ? { operation: 'ganttColumnUpdate' as const, ganttViewColumnId: colId }
              : { operation: 'gridColumnUpdate' as const, gridViewColumnId: colId }

          await $api.internal.postOperation(view.value!.fk_workspace_id!, view.value!.base_id!, operationParams, props)
        }

        if (gridViewCols.value?.[id]) {
          Object.assign(gridViewCols.value[id], {
            ...gridViewCols.value[id],
            ...props,
          })
        } else {
          // fallback to reload
          await loadViewColumns()
        }

        persistInterfaceGridColumn(id, props)
      } catch (e) {
        // this could happen if user doesn't have permission to update view columns
        // todo: find out root cause and handle with isUIAllowed
        console.error(e)
      }
    }

    watch(
      sortedAndFilteredFields,
      (v) => {
        if (rootFields) rootFields.value = v || []
      },
      { immediate: true },
    )

    const evtListener = (evt: string, payload: any) => {
      if (payload.fk_view_id !== view.value?.id) return

      if (evt === 'view_column_update') {
        const col = gridViewCols.value?.[payload.fk_column_id]
        if (col) {
          const reloadNeeded = payload?.group_by !== col?.group_by || (!col.show && payload?.show)
          const aggregationChanged = 'aggregation' in payload && payload.aggregation !== col?.aggregation

          Object.assign(col, payload)

          const field = fields.value?.find((f) => f.fk_column_id === payload.fk_column_id)
          if (field) {
            const currentColumnField = col || {}
            Object.assign(field, {
              show: currentColumnField.show || isColumnViewEssential(currentColumnField),
              order: currentColumnField.order || order++,
              aggregation: currentColumnField?.aggregation ?? CommonAggregations.None,
            })

            fields.value?.sort((a: Field, b: Field) => a.order - b.order)
          }

          if (reloadNeeded) {
            nextTick(() => reloadData?.({ shouldShowLoading: false }))
          }

          if (aggregationChanged) {
            $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.AGGREGATION_RELOAD)
          }

          $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
        }
      } else if (evt === 'view_column_refresh') {
        loadViewColumns()
        nextTick(() => reloadData?.({ shouldShowLoading: false }))
      }
    }

    onMounted(() => {
      $eventBus.realtimeViewMetaEventBus.on(evtListener)
    })

    onBeforeUnmount(() => {
      $eventBus.realtimeViewMetaEventBus.off(evtListener)
    })

    provide(FieldsInj, rootFields)

    return {
      fields,
      fieldsMap,
      loadViewColumns,
      filteredFieldList,
      searchBasisIdMap,
      numberOfHiddenFields,
      filterQuery,
      showAll,
      hideAll,
      saveOrUpdate,
      applyVisibilityLocally,
      buildVisibilityEntry,
      isDefaultView,
      sortedAndFilteredFields,
      showSystemFields,
      metaColumnById,
      toggleFieldVisibility,
      adjustFrozenFieldsOnVisibilityChange,
      adjustFrozenFieldsOnBulkHide,
      toggleFieldStyles,
      isViewColumnsLoading,
      updateGridViewColumn,
      gridViewCols,
      resizingColOldWith,
      isLocalMode,
      updateDefaultViewColumnMeta,
      hidingViewColumnsMap,
      hasViewFieldDataEditPermission,
      canUpdateViewMeta,
    }
  },
  'useViewColumnsOrThrow',
)

export { useProvideViewColumns }

export function useViewColumnsOrThrow() {
  const viewColumns = useViewColumns()
  if (viewColumns == null) throw new Error('Please call `useProvideViewColumns` on the appropriate parent component')
  return viewColumns
}
