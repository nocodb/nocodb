import {
  type ColumnType,
  type FilterType,
  type LinkToAnotherRecordType,
  type LookupType,
  type ViewType,
  getEquivalentUIType,
  isDateType,
  parseProp,
} from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

export type ColumnFilterType = FilterType & {
  status?: string
  id?: string
  // used in new viewmodel to keep reference when not yet saved
  tmp_id?: string
  tmp_fk_parent_id: string
  parent?: ColumnFilterType
  children?: ColumnFilterType[]
  is_group?: boolean
}

export function useViewFilters(
  view: Ref<ViewType | undefined>,
  _parentId: Ref<string | null> | null | string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
  _currentFilters?: ColumnFilterType[],
  isNestedRoot?: boolean,
  isWebhook?: boolean,
  isLink?: boolean,
  isWorkflow?: boolean,
  isWidget?: boolean,
  widgetId?: Ref<string | null>,
  linkColId?: Ref<string>,
  fieldsToFilter?: Ref<ColumnType[]>,
  parentColId?: Ref<string>,
  isTempFilters?: boolean,
) {
  const savingStatus: Record<number, boolean> = {}

  const parentId = ref(_parentId)

  const currentFilters = ref(_currentFilters)

  const btLookupTypesMap = ref<Record<string, any>>({})

  const reloadHook = inject(ReloadViewDataHookInj)

  const { nestedFilters, isForm, allFilters } =
    isWidget || isWorkflow
      ? {
          nestedFilters: ref([]),
          isForm: ref(false),
          allFilters: ref([]),
        }
      : useSmartsheetStoreOrThrow()

  const { baseMeta } = storeToRefs(useBase())

  const isPublic = inject(IsPublicInj, ref(false))

  const isTemp = computed(() => isPublic.value || isTempFilters)

  const { $api, $e, $eventBus } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { getMeta, getMetaByKey } = useMetas()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const meta = inject(MetaInj, ref())

  const _filters = ref<ColumnFilterType[]>([...(currentFilters.value || [])])

  const nestedMode = computed(() => isTemp.value || !isUIAllowed('filterList') || !isUIAllowed('filterChildrenList'))

  // Tracks if any filter has been updated - used for webhook save state management
  const isFilterUpdated = ref<boolean>(false)

  // Get the correct base_id for API calls
  // For link filters, we need to use the link column's base_id (from the origin table)
  // not the related table's base_id
  const apiBaseId = computed(() => {
    // For lookup column filters: when editing a lookup, MetaInj is set to the related table
    // but we need the origin table's base_id. The view object has the correct base_id.
    if (view.value?.base_id) {
      return view.value.base_id
    }

    if (linkColId?.value && fieldsToFilter?.value) {
      // Find the link column to get its base_id
      const linkColumn = fieldsToFilter.value.find((col) => col.id === linkColId.value)
      if (linkColumn?.base_id) {
        return linkColumn.base_id
      }
    }
    // Fallback to meta's base_id (for webhooks, widgets, etc.)
    return meta.value?.base_id
  })

  const apiWorkspaceId = computed(() => {
    // Prefer view's workspace_id when available
    if (view.value?.fk_workspace_id) {
      return view.value.fk_workspace_id
    }
    return meta.value?.fk_workspace_id
  })

  const filters = computed<ColumnFilterType[]>({
    get: () => {
      return (nestedMode.value && !isLink && !isWebhook && !isWidget && !isWorkflow) || (isForm.value && !isWebhook)
        ? currentFilters.value!
        : _filters.value
    },
    set: (value: ColumnFilterType[]) => {
      if (isForm.value && !isWebhook) {
        currentFilters.value = value
        return
      } else if (nestedMode.value || isWorkflow) {
        currentFilters.value = value
        if (!isLink && !isWebhook && !isWidget && !isWorkflow) {
          if (!isNestedRoot) {
            nestedFilters.value = value
          }
          nestedFilters.value = [...nestedFilters.value]
        }
        if (!isWorkflow) reloadHook?.trigger()
        return
      }

      _filters.value = value
    },
  })

  const getDraftFilterId = (): string => {
    let id: string

    do {
      id = generateRandomUUID()
    } while ((filters.value || []).some((f) => f.id === id || f.tmp_id === id))

    return id
  }

  // when a filter is deleted with auto apply disabled, the status is marked as 'delete'
  // nonDeletedFilters are those filters that are not deleted physically & virtually
  const nonDeletedFilters = computed(() => filters.value.filter((f) => f.status !== 'delete'))

  const activeView = inject(ActiveViewInj, ref())

  const { showSystemFields, fieldsMap } =
    widgetId?.value || isWorkflow ? { showSystemFields: ref(false), fieldsMap: ref({}) } : useViewColumnsOrThrow()

  const options = computed<SelectProps['options']>(() =>
    meta.value?.columns?.filter((c: ColumnType) => {
      if (isSystemColumn(c)) {
        /** hide system columns if not enabled */
        return showSystemFields.value
      } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID || c.system) {
        return false
      } else {
        const isVirtualSystemField = c.colOptions && c.system
        return !isVirtualSystemField
      }
    }),
  )

  const types = computed(() => {
    if (!meta.value?.columns?.length) {
      return {}
    }

    return meta.value?.columns?.reduce((obj: any, col: any) => {
      if (col.uidt === UITypes.Formula) {
        const formulaUIType = getEquivalentUIType({
          formulaColumn: col,
        })

        obj[col.id] = formulaUIType || col.uidt
      }
      // if column is a lookup column, then use the lookup type extracted from the column
      else if (btLookupTypesMap.value[col.id]) {
        obj[col.id] = btLookupTypesMap.value[col.id].uidt
      } else {
        obj[col.id] = col.uidt
      }
      return obj
    }, {})
  })

  const lastFilters = ref<ColumnFilterType[]>([])

  watchOnce(filters, (filters: ColumnFilterType[]) => {
    lastFilters.value = clone(filters)
  })

  // get delta between two objects and return the changed fields (value is from b)
  const getFieldDelta = (a: any, b: any) => {
    return Object.entries(b)
      .filter(([key, val]) => a[key] !== val && key in a)
      .reduce((a, [key, v]) => ({ ...a, [key]: v }), {})
  }

  const isComparisonOpAllowed = (
    filter: ColumnFilterType,
    compOp: {
      text: string
      value: string
      ignoreVal?: boolean
      includedTypes?: UITypes[]
      excludedTypes?: UITypes[]
    },
  ) => {
    const isNullOrEmptyOp = ['empty', 'notempty', 'null', 'notnull'].includes(compOp.value)
    const uidt = types.value[filter.fk_column_id!]

    if (compOp.includedTypes) {
      // include allowed values only if selected column type matches
      if (filter.fk_column_id && compOp.includedTypes.includes(uidt)) {
        // for 'empty', 'notempty', 'null', 'notnull',
        // show them based on `showNullAndEmptyInFilter` in Base Settings
        return isNullOrEmptyOp ? baseMeta.value.showNullAndEmptyInFilter : true
      } else {
        return false
      }
    } else if (compOp.excludedTypes) {
      // include not allowed values only if selected column type not matches
      if (filter.fk_column_id && !compOp.excludedTypes.includes(uidt)) {
        // for 'empty', 'notempty', 'null', 'notnull',
        // show them based on `showNullAndEmptyInFilter` in Base Settings
        return isNullOrEmptyOp ? baseMeta.value.showNullAndEmptyInFilter : true
      } else {
        return false
      }
    }
    // explicitly include for non-null / non-empty ops
    return isNullOrEmptyOp ? baseMeta.value.showNullAndEmptyInFilter : true
  }

  const isComparisonSubOpAllowed = (
    filter: ColumnFilterType,
    compOp: {
      text: string
      value: string
      ignoreVal?: boolean
      includedTypes?: UITypes[]
      excludedTypes?: UITypes[]
    },
  ) => {
    const uidt = types.value[filter.fk_column_id!]

    if (compOp.includedTypes) {
      // include allowed values only if selected column type matches
      return filter.fk_column_id && compOp.includedTypes.includes(uidt)
    } else if (compOp.excludedTypes) {
      // include not allowed values only if selected column type not matches
      return filter.fk_column_id && !compOp.excludedTypes.includes(uidt)
    }
  }

  const placeholderFilter = (): ColumnFilterType => {
    const logicalOps = new Set(filters.value.slice(1).map((filter) => filter.logical_op))

    const defaultColumn = fieldsToFilter?.value?.find((col) => {
      return !isSystemColumn(col) && !(fieldsMap.value[col.id] && !fieldsMap.value[col.id]?.initialShow)
    })

    const filter: ColumnFilterType = {
      tmp_id: getDraftFilterId(),
      comparison_op: comparisonOpList(options.value?.[0].uidt as UITypes).filter((compOp) =>
        isComparisonOpAllowed({ fk_column_id: options.value?.[0].id }, compOp),
      )?.[0]?.value as FilterType['comparison_op'],
      value: null,
      status: 'create',
      logical_op: logicalOps.size === 1 ? logicalOps.values().next().value : 'and',
      // set the default column to the first column in the list, excluding system columns
      fk_column_id: defaultColumn?.id ?? undefined,
      ...(parentColId?.value ? { fk_parent_column_id: parentColId.value } : {}),
      ...(widgetId?.value ? { fk_widget_id: widgetId.value } : {}),
      order: (filters.value.length ? Math.max(...filters.value.map((item) => item?.order ?? 0)) : 0) + 1,
    }

    // Set timezone for DateTime columns
    if (defaultColumn && isDateType(defaultColumn.uidt as UITypes)) {
      const columnMeta = parseProp(defaultColumn.meta)
      const columnTimezone = columnMeta?.timezone
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const timezone = columnTimezone || browserTimezone

      filter.meta = {
        timezone,
      }
    }

    return filter
  }

  const placeholderGroupFilter = (): ColumnFilterType => {
    const logicalOps = new Set(filters.value.slice(1).map((filter) => filter.logical_op))

    return {
      tmp_id: getDraftFilterId(),
      is_group: true,
      status: 'create',
      logical_op: logicalOps.size === 1 ? logicalOps.values().next().value : 'and',
      ...(parentColId?.value ? { fk_parent_column_id: parentColId.value, children: [] } : {}),
      ...(widgetId?.value ? { fk_widget_id: widgetId.value } : {}),
      order: (filters.value.length ? Math.max(...filters.value.map((item) => item?.order ?? 0)) : 0) + 1,
    }
  }

  const findFilterById = (filters: ColumnFilterType[] = [], parentId: string): ColumnFilterType | null => {
    for (const filter of filters) {
      if (filter.id === parentId || filter.tmp_id === parentId) {
        return filter
      }

      if (filter.children?.length) {
        const found = findFilterById(filter.children, parentId)
        if (found) return found
      }
    }
    return null
  }

  const loadAllChildFilters = async (filters: ColumnFilterType[]) => {
    // Array to store promises of child filter loading
    const promises = []

    // Array to store all child filters
    const allChildFilters: ColumnFilterType[] = []

    // Iterate over all filters
    for (const filter of filters) {
      // Check if the filter is a group
      if (filter.id && filter.is_group) {
        // Load children filters from the backend
        const childFilterPromise = $api.internal
          .getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
            operation: 'filterChildrenList',
            filterId: filter.id,
          })
          .then((response) => {
            const childFilters = (response.list as ColumnFilterType[]).sort((a, b) => ncArrSortCallback(a, b, { key: 'order' }))
            allChildFilters.push(...childFilters)
            return loadAllChildFilters(childFilters)
          })
        promises.push(childFilterPromise)
      }
    }

    // Wait for all promises to resolve
    await Promise.all(promises)

    // Push all child filters into the allFilters array
    if (!isLink && !isWebhook && !isWidget) allFilters.value.push(...(allChildFilters as FilterType[]))
  }

  const loadFilters = async ({
    hookId,
    isLink,
    widgetId,
    isWebhook,
    isWidget,
    loadAllFilters,
  }: {
    hookId?: string
    widgetId?: string
    isWebhook?: boolean
    isWidget?: boolean
    loadAllFilters?: boolean
    isLink?: boolean
  } = {}) => {
    if (!view.value?.id || !meta.value) return
    if (
      (nestedMode.value && (isTemp.value || !isUIAllowed('filterChildrenList'))) ||
      (isForm.value && !isWebhook) ||
      isWorkflow
    ) {
      // ignore restoring if not root filter group
      return
    }

    try {
      if (isWebhook || hookId) {
        if (parentId.value) {
          filters.value = (
            await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
              operation: 'filterChildrenList',
              filterId: parentId.value,
            })
          ).list as ColumnFilterType[]
        } else if (hookId && !isNestedRoot) {
          filters.value = (
            await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
              operation: 'hookFilterList',
              hookId,
            })
          ).list as ColumnFilterType[]
        }
      } else {
        if (isLink || linkColId?.value) {
          if (parentId.value) {
            filters.value = (
              await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
                operation: 'filterChildrenList',
                filterId: parentId.value,
              })
            ).list as ColumnFilterType[]
          } else if (linkColId?.value && !isNestedRoot) {
            filters.value = (
              await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
                operation: 'linkFilterList',
                columnId: linkColId.value,
              })
            ).list as ColumnFilterType[]
          }
        } else if (isWidget || widgetId) {
          if (parentId.value) {
            filters.value = (
              await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
                operation: 'filterChildrenList',
                filterId: parentId.value,
              })
            ).list as ColumnFilterType[]
          } else if (widgetId && !isNestedRoot) {
            filters.value = (
              await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
                operation: 'widgetFilterList',
                widgetId,
              })
            ).list as ColumnFilterType[]
          }
        } else {
          if (parentId.value) {
            filters.value = (
              await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
                operation: 'filterChildrenList',
                filterId: parentId.value,
              })
            ).list as ColumnFilterType[]
          } else {
            filters.value = (
              await $api.internal.getOperation(apiWorkspaceId.value!, apiBaseId.value!, {
                operation: 'filterList',
                viewId: view.value!.id!,
              })
            ).list as ColumnFilterType[]
            if (loadAllFilters) {
              allFilters.value = [...filters.value] as FilterType[]
              await loadAllChildFilters(allFilters.value as ColumnFilterType[])
            }
          }
        }
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const sync = async ({
    hookId,
    linkId,
    widgetId,
  }: {
    hookId?: string
    nested?: boolean
    linkId?: string
    widgetId?: string
  }) => {
    try {
      for (const [i, filter] of Object.entries(filters.value)) {
        if (filter.status === 'delete') {
          await $api.internal.postOperation(
            apiWorkspaceId.value!,
            apiBaseId.value!,
            {
              operation: 'filterDelete',
              filterId: filter.id as string,
            },
            {},
          )
          if (filter.is_group) {
            deleteFilterGroupFromAllFilters(filter)
          } else {
            if (!isLink && !isWebhook && !isWidget) allFilters.value = allFilters.value.filter((f) => f.id !== filter.id)
          }
        } else if (filter.status === 'update') {
          await $api.internal.postOperation(
            apiWorkspaceId.value!,
            apiBaseId.value!,
            {
              operation: 'filterUpdate',
              filterId: filter.id as string,
            },
            {
              ...filter,
              fk_parent_id: parentId.value,
            },
          )
        } else if (filter.status === 'create') {
          // extract children value if found to restore
          const children = filters.value[+i]?.children
          if (hookId) {
            filters.value[+i] = (await $api.internal.postOperation(
              apiWorkspaceId.value!,
              apiBaseId.value!,
              {
                operation: 'hookFilterCreate',
                hookId,
              },
              {
                ...filter,
                children: undefined,
                fk_parent_id: parentId.value,
              } as FilterType,
            )) as ColumnFilterType
          } else if (linkId || linkColId?.value) {
            filters.value[+i] = (await $api.internal.postOperation(
              apiWorkspaceId.value!,
              apiBaseId.value!,
              {
                operation: 'linkFilterCreate',
                columnId: linkId || linkColId!.value,
              },
              {
                ...filter,
                children: undefined,
                fk_parent_id: parentId.value,
              } as FilterType,
            )) as ColumnFilterType
          } else if (widgetId) {
            filters.value[+i] = (await $api.internal.postOperation(
              apiWorkspaceId.value!,
              apiBaseId.value!,
              {
                operation: 'widgetFilterCreate',
                widgetId,
              },
              {
                ...filter,
                children: undefined,
                fk_parent_id: parentId.value,
              } as FilterType,
            )) as ColumnFilterType
          } else {
            filters.value[+i] = (await $api.internal.postOperation(
              apiWorkspaceId.value!,
              apiBaseId.value!,
              {
                operation: 'filterCreate',
                viewId: view?.value?.id as string,
              },
              {
                ...filter,
                fk_parent_id: parentId.value,
              } as FilterType,
            )) as ColumnFilterType
          }

          if (children) filters.value[+i].children = children

          if (!isLink && !isWebhook && !isWidget) allFilters.value.push(filters.value[+i] as FilterType)
        }
      }

      if (!isWebhook && !isLink && !isWidget) reloadData?.()
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdateDebounced = useCachedDebouncedFunction(saveOrUpdate, 500, (_filter: ColumnFilterType, i: number) => i)

  async function saveOrUpdate(
    filter: ColumnFilterType,
    i: number,
    force = false,
    undo = false,
    skipDataReload = false,
    lastFilterIndex: number | undefined = undefined,
  ) {
    // if already in progress the debounced function which will call this function again with 500ms delay until it's not saving
    if (savingStatus[i]) {
      return saveOrUpdateDebounced(filter, i, force, undo, skipDataReload, lastFilterIndex)
    }
    // wait if any previous filter save is in progress, it's to avoid messing up the order of filters
    else if (Array.from({ length: i }).some((_, index) => savingStatus[index])) {
      return saveOrUpdateDebounced(filter, i, force, undo, skipDataReload, lastFilterIndex)
    }
    savingStatus[i] = true
    if (ncIsUndefined(lastFilterIndex)) {
      lastFilterIndex = i
    }

    if (!view.value && !linkColId?.value && !widgetId?.value) return

    if (!undo && !(isForm.value && !isWebhook)) {
      const lastFilter = lastFilters.value[lastFilterIndex]

      if (lastFilter) {
        const delta = clone(getFieldDelta(filter, lastFilter)) as Partial<ColumnFilterType>
        const keys = Object.keys(delta)

        if (keys.length > 0) {
          // Define extra keys to track
          const extraKeys = ['value', 'order', 'logical_op']

          // Always include the 0th key + any of the extra ones present
          const targetKeys = Array.from(
            new Set([
              keys[0], // backward compat
              ...keys.filter((k) => extraKeys.includes(k)), // allowed extras
            ]),
          )

          const undoChanges = Object.fromEntries(targetKeys.map((k) => [k, delta[k as keyof ColumnFilterType]]))
          const redoChanges = Object.fromEntries(targetKeys.map((k) => [k, filter[k as keyof ColumnFilterType]]))

          addUndo({
            undo: {
              fn: (changes: Partial<ColumnFilterType>, index: number) => {
                const f = filters.value[index]

                // If parent filter is deleted then skip
                if (f && (!f.fk_parent_id || findFilterById(filters.value, f.fk_parent_id))) {
                  for (const [prop, val] of Object.entries(changes)) {
                    f[prop as keyof ColumnFilterType] = val
                  }
                  saveOrUpdate(f, index, force, true)
                }
              },
              args: [undoChanges, i],
            },
            redo: {
              fn: (changes: Partial<ColumnFilterType>, index: number) => {
                const f = filters.value[index]

                // If parent filter is deleted then skip
                if (f && (!f.fk_parent_id || findFilterById(filters.value, f.fk_parent_id))) {
                  for (const [prop, val] of Object.entries(changes)) {
                    f[prop as keyof ColumnFilterType] = val
                  }
                  saveOrUpdate(f, index, force, true)
                }
              },
              args: [redoChanges, lastFilterIndex],
            },
            scope: defineViewScope({ view: activeView.value }),
          })
        }
      }
    }
    try {
      if (nestedMode.value || isWorkflow) {
        filters.value[i] = { ...filter }
        filters.value = [...filters.value].sort((a, b) => ncArrSortCallback(a, b, { key: 'order' }))
      } else if (!autoApply?.value && !force) {
        filter.status = filter.id ? 'update' : 'create'
        isFilterUpdated.value = true
      } else if (filters.value[i]?.id && filters.value[i]?.status !== 'create') {
        await $api.internal.postOperation(
          apiWorkspaceId.value!,
          apiBaseId.value!,
          {
            operation: 'filterUpdate',
            filterId: filters.value[i].id!,
          },
          {
            ...filter,
            fk_parent_id: parentId.value,
          },
        )
        $e('a:filter:update', {
          logical: filter.logical_op,
          comparison: filter.comparison_op,
          order: filter.order,
          link: !!isLink,
          widget: !!isWidget,
          webHook: !!isWebhook,
          workflow: !!isWorkflow,
        })

        if (undo) {
          filters.value = [...filters.value].sort((a, b) => ncArrSortCallback(a, b, { key: 'order' }))
        }
      } else {
        if (linkColId?.value) {
          const savedFilter = await $api.internal.postOperation(
            apiWorkspaceId.value!,
            apiBaseId.value!,
            {
              operation: 'linkFilterCreate',
              columnId: linkColId.value,
            },
            {
              ...filter,
              fk_parent_id: parentId.value,
            },
          )
          // extract id from saved filter and update the filter object
          // avoiding whole object update to prevent overwriting of current filter object changes
          filters.value[i] = {
            ...filters.value[i],
            fk_parent_id: parentId.value,
            id: savedFilter.id,
            status: undefined,
          } as ColumnFilterType
        } else if (widgetId?.value) {
          const savedFilter = await $api.internal.postOperation(
            apiWorkspaceId.value!,
            apiBaseId.value!,
            {
              operation: 'widgetFilterCreate',
              widgetId: widgetId.value,
            },
            {
              ...filter,
              fk_parent_id: parentId.value,
            },
          )
          // extract id from saved filter and update the filter object
          // avoiding whole object update to prevent overwriting of current filter object changes
          filters.value[i] = {
            ...filters.value[i],
            fk_parent_id: parentId.value,
            id: savedFilter.id,
            status: undefined,
          } as ColumnFilterType
        } else {
          const savedFilter = await $api.internal.postOperation(
            apiWorkspaceId.value!,
            apiBaseId.value!,
            {
              operation: 'filterCreate',
              viewId: view.value!.id!,
            },
            {
              ...filter,
              fk_parent_id: parentId.value,
            },
          )
          // extract id from saved filter and update the filter object
          // avoiding whole object update to prevent overwriting of current filter object changes
          filters.value[i] = {
            ...filters.value[i],
            fk_parent_id: parentId.value,
            id: savedFilter.id,
            status: undefined,
          }

          filters.value = filters.value.sort((a, b) => ncArrSortCallback(a, b, { key: 'order' }))
        }
        if (!isLink && !isWebhook && !isWidget) allFilters.value.push(filters.value[+i] as FilterType)
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      savingStatus[i] = false
    }

    lastFilters.value = clone(filters.value)

    if (!isWebhook && !skipDataReload && !isLink && !isWidget) reloadData?.()
  }

  function deleteFilterGroupFromAllFilters(filter: ColumnFilterType) {
    if (!filter) return

    // if (!isLink && !isWebhook) return

    // Find all child filters of the specified parentId
    const childFilters = allFilters.value.filter((f) => f && f.fk_parent_id === filter.id)

    // Recursively delete child filter of child filter
    childFilters.forEach((childFilter) => {
      if (childFilter?.is_group) {
        deleteFilterGroupFromAllFilters(childFilter as ColumnFilterType)
      }
    })

    // Remove the parent object and its children from the array
    allFilters.value = allFilters.value.filter((f) => f && f.id !== filter.id && f.fk_parent_id !== filter.id)
  }

  const deleteFilter = async (filter: ColumnFilterType, i: number, undo = false) => {
    if (!filter) return

    // update the filter status
    filter.status = 'delete'

    isFilterUpdated.value = true

    if (!undo && !filter.is_group && !(isForm.value && !isWebhook)) {
      addUndo({
        undo: {
          fn: async (fl: ColumnFilterType) => {
            fl.status = 'create'
            filters.value.splice(i, 0, fl)
            await saveOrUpdate(fl, i, false, true)
          },
          args: [clone(filter)],
        },
        redo: {
          fn: async (index: number) => {
            await deleteFilter(filters.value[index], index, true)
          },
          args: [i],
        },
        scope: defineViewScope({ view: activeView.value }),
      })
    }
    // if shared or sync permission not allowed simply remove it from array
    if (nestedMode.value || isWorkflow) {
      filters.value.splice(i, 1)
      filters.value = [...filters.value].sort((a, b) => ncArrSortCallback(a, b, { key: 'order' }))
      if (!isWebhook && !isLink && !isWidget && !isWorkflow) reloadData?.()
    } else {
      if (filter.id) {
        // if auto-apply disabled mark it as disabled
        if (!autoApply?.value) {
          filter.status = 'delete'
          // if auto-apply enabled invoke delete api and remove from array
          // no splice is required here
        } else {
          try {
            await $api.internal.postOperation(
              apiWorkspaceId.value!,
              apiBaseId.value!,
              {
                operation: 'filterDelete',
                filterId: filter.id,
              },
              {},
            )
            if (!isWebhook && !isLink && !isWidget) reloadData?.()

            // find item index by using id and remove it from array since item index may change
            const itemIndex = filters.value.findIndex((f) => f.id === filter.id)
            if (itemIndex > -1) filters.value.splice(itemIndex, 1)
          } catch (e: any) {
            console.log(e)
            message.error(await extractSdkResponseErrorMsg(e))
          }
        }
        // if not synced yet remove it from array
      } else {
        filters.value.splice(i, 1)
      }
      $e('a:filter:delete', {
        length: nonDeletedFilters.value.length,
        link: !!isLink,
        webHook: !!isWebhook,
        widget: !!isWidget,
        workflow: !!isWorkflow,
      })
    }

    if (filter.is_group) {
      deleteFilterGroupFromAllFilters(filter)
    } else {
      if (!isLink && !isWebhook && !isWidget) allFilters.value = allFilters.value.filter((f) => f.id !== filter.id)
    }
  }

  const STRIP_KEYS = ['id', 'tmp_id', 'status', 'fk_parent_id']

  function normalizeFilterNode(filter: FilterType = {}, extra_strip_keys: Array<string> = []): ColumnFilterType {
    const raw = clone(filter) as any

    // remove runtime / persisted props
    for (const key of STRIP_KEYS) {
      delete raw[key]
    }

    for (const key of extra_strip_keys) {
      delete raw[key]
    }

    // 🔹 GROUP FILTER
    if (raw.is_group) {
      const group = placeholderGroupFilter()

      // apply allowed props (logical_op, fk_column_id, etc.)
      Object.assign(group, raw)

      // children must exist for group
      group.children = ncIsArray(raw.children)
        ? raw.children.filter((child) => child && child.status !== 'delete').map((child) => normalizeFilterNode(child))
        : []

      // reset order for children
      group.children!.forEach((child, index) => {
        child.order = child.order ?? index + 1
      })

      return group
    }

    // 🔹 LEAF FILTER
    const leaf = placeholderFilter()
    Object.assign(leaf, raw)

    return leaf
  }

  const addFilter = async (undo = false, draftFilter: Partial<FilterType> = {}) => {
    isFilterUpdated.value = true

    filters.value.push(
      (draftFilter?.fk_column_id
        ? { ...placeholderFilter(), ...normalizeFilterNode(draftFilter, ['order', 'logical_op']) }
        : placeholderFilter()) as ColumnFilterType,
    )
    if (!undo && !(isForm.value && !isWebhook)) {
      addUndo({
        undo: {
          fn: async function undo(this: UndoRedoAction, i: number) {
            this.redo.args = [i, clone(filters.value[i])]
            await deleteFilter(filters.value[i], i, true)
          },
          args: [filters.value.length - 1],
        },
        redo: {
          fn: async (i: number, fl: ColumnFilterType) => {
            fl.status = 'create'
            filters.value.splice(i, 0, fl)
            await saveOrUpdate(fl, i, false, true)
          },
          args: [],
        },
        scope: defineViewScope({ view: activeView.value }),
      })
    }

    // if we copy filter then save it immediately
    if (draftFilter && Object.keys(draftFilter).length > 1 && !(isForm.value && !isWebhook)) {
      await saveOrUpdate(filters.value[filters.value.length - 1], filters.value.length - 1, false, true)
    }

    lastFilters.value = clone(filters.value)

    $e('a:filter:add', {
      length: filters.value.length,
      link: !!isLink,
      webHook: !!isWebhook,
      widget: !!isWidget,
      workflow: !!isWorkflow,
    })
  }

  const addFilterGroup = async (draftFilter: Partial<ColumnFilterType> = {}) => {
    isFilterUpdated.value = true

    const placeHolderGroupFilter: ColumnFilterType = placeholderGroupFilter()

    const draftFilterHasChildren = draftFilter && ncIsArray(draftFilter.children) && draftFilter.children.length > 0

    if (draftFilterHasChildren) {
      draftFilter.children = draftFilter.children.map((child) => normalizeFilterNode(child))

      placeHolderGroupFilter.children = draftFilter.children
    } else if (nestedMode.value || isWorkflow) {
      const child = placeholderFilter()
      child.order = 1

      placeHolderGroupFilter.children = [child]
    }

    filters.value.push(placeHolderGroupFilter)

    const index = filters.value.length - 1

    if (draftFilterHasChildren && !(isForm.value && !isWebhook)) {
      addUndo({
        undo: {
          fn: async function undo(this: UndoRedoAction, i: number) {
            this.redo.args = [i, clone(filters.value[i])]
            await deleteFilter(filters.value[i], i, true)
          },
          args: [filters.value.length - 1],
        },
        redo: {
          fn: async (i: number, fl: ColumnFilterType) => {
            fl.status = 'create'
            filters.value.splice(i, 0, fl)
            await saveOrUpdate(fl, i, false, true)
          },
          args: [],
        },
        scope: defineViewScope({ view: activeView.value }),
      })
    }

    await saveOrUpdate(filters.value[index], index, false, !!draftFilterHasChildren)

    lastFilters.value = clone(filters.value)

    $e('a:filter:add', {
      length: filters.value.length,
      group: true,
      link: !!isLink,
      webHook: !!isWebhook,
      widget: !!isWidget,
      workflow: !!isWorkflow,
    })
  }

  /** on column delete reload filters, identify by checking columns count */
  watch(
    () => {
      if (!view?.value) return 0

      const tableMeta = getMetaByKey(meta.value?.base_id as string, view.value.fk_model_id as string)
      if (!tableMeta) return 0

      return tableMeta.columns?.length || 0
    },
    async (nextColsLength: number, oldColsLength: number) => {
      if (nextColsLength && nextColsLength < oldColsLength) await loadFilters()
    },
  )

  // method to extract looked up column meta for all bt lookup columns
  // it helps to decide the condition operations for the column
  const loadBtLookupTypes = async () => {
    const btLookupTypes: Record<string, any> = {}
    try {
      for (const col of meta.value?.columns || []) {
        if (col.uidt !== UITypes.Lookup) continue
        let nextCol: ColumnType | undefined = col
        let currentBaseId = meta.value!.base_id!
        // check all the relation of nested lookup columns is bt or not
        // include the column only if all only if all relations are bt
        while (nextCol && nextCol.uidt === UITypes.Lookup) {
          // extract the relation column meta
          const lookupRelation = (await getMeta(currentBaseId, nextCol.fk_model_id!))?.columns?.find(
            (c) => c.id === (nextCol!.colOptions as LookupType).fk_relation_column_id,
          )

          // this is less likely to happen but if relation column is not found then break the loop
          if (!lookupRelation) {
            break
          }

          // Get the related base_id from the link column options (for cross-base links)
          const relatedBaseId = (lookupRelation?.colOptions as any)?.fk_related_base_id || currentBaseId

          const relatedTableMeta = await getMeta(
            relatedBaseId,
            (lookupRelation?.colOptions as LinkToAnotherRecordType).fk_related_model_id!,
          )
          nextCol = relatedTableMeta?.columns?.find((c) => c.id === (nextCol!.colOptions as LookupType).fk_lookup_column_id)

          // Update currentBaseId for the next iteration
          currentBaseId = relatedBaseId

          // if next column is same as root lookup column then break the loop
          // since it's going to be a circular loop
          if (nextCol?.id === col.id) {
            break
          }
        }
        btLookupTypes[col.id!] = nextCol
      }
      btLookupTypesMap.value = btLookupTypes
    } catch (e) {
      // ignore error since it is not blocking any functionality of the app
      console.error(e)
    }
  }

  const evtListener = (evt: string, payload: any) => {
    if (payload.fk_view_id !== view.value?.id || isTempFilters) return

    if (evt === 'filter_create') {
      allFilters.value.push(payload)
      if ((!payload.fk_parent_id && !parentId.value) || payload.fk_parent_id === parentId.value) {
        filters.value.push(payload)
      }
      reloadHook?.trigger()
    } else if (evt === 'filter_update') {
      const index = filters.value.findIndex((f) => f.id === payload.id)
      if (index !== -1) {
        filters.value[index] = payload
        filters.value = [...filters.value].sort((a, b) => ncArrSortCallback(a, b, { key: 'order' }))
      }

      const allIndex = allFilters.value.findIndex((f) => f.id === payload.id)
      if (allIndex !== -1) {
        allFilters.value[allIndex] = payload
      }

      reloadHook?.trigger()
    } else if (evt === 'filter_delete') {
      filters.value = filters.value.filter((f) => f.id !== payload.id)
      if (payload.is_group) {
        deleteFilterGroupFromAllFilters(payload)
      } else {
        allFilters.value = allFilters.value.filter((f) => f.id !== payload.id)
      }
      reloadHook?.trigger()
    }
  }

  onMounted(() => {
    if (!isTempFilters) $eventBus.realtimeViewMetaEventBus.on(evtListener)
  })

  onBeforeUnmount(() => {
    if (!isTempFilters) $eventBus.realtimeViewMetaEventBus.off(evtListener)
  })

  return {
    filters,
    lastFilters,
    nonDeletedFilters,
    loadFilters,
    sync,
    deleteFilter,
    saveOrUpdate,
    addFilter,
    addFilterGroup,
    saveOrUpdateDebounced,
    isComparisonOpAllowed,
    isComparisonSubOpAllowed,
    loadBtLookupTypes,
    btLookupTypesMap,
    types,
    isFilterUpdated,
  }
}
