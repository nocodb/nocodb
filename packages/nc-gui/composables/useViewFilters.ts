import {
  type ColumnType,
  type FilterType,
  type LinkToAnotherRecordType,
  type LookupType,
  type ViewType,
  getEquivalentUIType,
} from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

type ColumnFilterType = FilterType & { status?: string; id?: string; children?: ColumnFilterType[]; is_group?: boolean }

export function useViewFilters(
  view: Ref<ViewType | undefined>,
  _parentId: Ref<string | null> | null | string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
  _currentFilters?: ColumnFilterType[],
  isNestedRoot?: boolean,
  isWebhook?: boolean,
  isLink?: boolean,
  linkColId?: Ref<string>,
  fieldsToFilter?: Ref<ColumnType[]>,
  parentColId?: Ref<string>,
) {
  const savingStatus: Record<number, boolean> = {}

  const parentId = ref(_parentId)

  const currentFilters = ref(_currentFilters)

  const btLookupTypesMap = ref<Record<string, any>>({})

  const reloadHook = inject(ReloadViewDataHookInj)

  const { nestedFilters, allFilters, isForm } = useSmartsheetStoreOrThrow()

  const { baseMeta } = storeToRefs(useBase())

  const isPublic = inject(IsPublicInj, ref(false))

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { metas, getMeta } = useMetas()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const _filters = ref<ColumnFilterType[]>([...(currentFilters.value || [])])

  const nestedMode = computed(() => isPublic.value || !isUIAllowed('filterSync') || !isUIAllowed('filterChildrenRead'))

  const filters = computed<ColumnFilterType[]>({
    get: () => {
      return (nestedMode.value && !isLink && !isWebhook) || (isForm.value && !isWebhook) ? currentFilters.value! : _filters.value
    },
    set: (value: ColumnFilterType[]) => {
      if (isForm.value && !isWebhook) {
        currentFilters.value = value
        return
      } else if (nestedMode.value) {
        currentFilters.value = value
        if (!isLink && !isWebhook) {
          if (!isNestedRoot) {
            nestedFilters.value = value
          }
          nestedFilters.value = [...nestedFilters.value]
        }
        reloadHook?.trigger()
        return
      }

      _filters.value = value
    },
  })

  // when a filter is deleted with auto apply disabled, the status is marked as 'delete'
  // nonDeletedFilters are those filters that are not deleted physically & virtually
  const nonDeletedFilters = computed(() => filters.value.filter((f) => f.status !== 'delete'))

  const meta = inject(MetaInj, ref())

  const activeView = inject(ActiveViewInj, ref())

  const { showSystemFields, metaColumnById } = useViewColumnsOrThrow()

  const options = computed<SelectProps['options']>(() =>
    meta.value?.columns?.filter((c: ColumnType) => {
      if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
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
    return {
      comparison_op: comparisonOpList(options.value?.[0].uidt as UITypes).filter((compOp) =>
        isComparisonOpAllowed({ fk_column_id: options.value?.[0].id }, compOp),
      )?.[0]?.value as FilterType['comparison_op'],
      value: null,
      status: 'create',
      logical_op: logicalOps.size === 1 ? logicalOps.values().next().value : 'and',
      // set the default column to the first column in the list, excluding system columns
      fk_column_id:
        fieldsToFilter?.value?.filter((col) => {
          return !isSystemColumn(col)
        })?.[0]?.id ?? undefined,
      ...(parentColId?.value ? { fk_parent_column_id: parentColId.value } : {}),
    }
  }

  const placeholderGroupFilter = (): ColumnFilterType => {
    const logicalOps = new Set(filters.value.slice(1).map((filter) => filter.logical_op))

    return {
      is_group: true,
      status: 'create',
      logical_op: logicalOps.size === 1 ? logicalOps.values().next().value : 'and',
      ...(parentColId?.value ? { fk_parent_column_id: parentColId.value, children: [] } : {}),
    }
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
        const childFilterPromise = $api.dbTableFilter.childrenRead(filter.id).then((response) => {
          const childFilters = response.list as ColumnFilterType[]
          allChildFilters.push(...childFilters)
          return loadAllChildFilters(childFilters)
        })
        promises.push(childFilterPromise)
      }
    }

    // Wait for all promises to resolve
    await Promise.all(promises)

    // Push all child filters into the allFilters array
    if (!isLink && !isWebhook) allFilters.value.push(...(allChildFilters as FilterType[]))
  }

  const loadFilters = async ({
    hookId,
    isLink,
    isWebhook,
    loadAllFilters,
  }: {
    hookId?: string
    isWebhook?: boolean
    loadAllFilters?: boolean
    isLink?: boolean
  } = {}) => {
    if (!view.value?.id) return

    if (nestedMode.value || (isForm.value && !isWebhook)) {
      // ignore restoring if not root filter group
      return
    }

    try {
      if (isWebhook || hookId) {
        if (parentId.value) {
          filters.value = (await $api.dbTableFilter.childrenRead(parentId.value)).list as ColumnFilterType[]
        } else if (hookId && !isNestedRoot) {
          filters.value = (await $api.dbTableWebhookFilter.read(hookId)).list as ColumnFilterType[]
        }
      } else {
        if (isLink || linkColId?.value) {
          if (parentId.value) {
            filters.value = (await $api.dbTableFilter.childrenRead(parentId.value)).list as ColumnFilterType[]
          } else if (linkColId?.value && !isNestedRoot) {
            filters.value = (await $api.dbTableLinkFilter.read(linkColId?.value)).list as ColumnFilterType[]
          }
        } else {
          if (parentId.value) {
            filters.value = (await $api.dbTableFilter.childrenRead(parentId.value)).list as ColumnFilterType[]
          } else {
            filters.value = (await $api.dbTableFilter.read(view.value!.id!)).list as ColumnFilterType[]
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

  const sync = async ({ hookId, linkId }: { hookId?: string; nested?: boolean; linkId?: string }) => {
    try {
      for (const [i, filter] of Object.entries(filters.value)) {
        if (filter.status === 'delete') {
          await $api.dbTableFilter.delete(filter.id as string)
          if (filter.is_group) {
            deleteFilterGroupFromAllFilters(filter)
          } else {
            if (!isLink && !isWebhook) allFilters.value = allFilters.value.filter((f) => f.id !== filter.id)
          }
        } else if (filter.status === 'update') {
          await $api.dbTableFilter.update(filter.id as string, {
            ...filter,
            fk_parent_id: parentId.value,
          })
        } else if (filter.status === 'create') {
          // extract children value if found to restore
          const children = filters.value[+i]?.children
          if (hookId) {
            filters.value[+i] = (await $api.dbTableWebhookFilter.create(hookId, {
              ...filter,
              children: undefined,
              fk_parent_id: parentId.value,
            } as FilterType)) as ColumnFilterType
          } else if (linkId || linkColId?.value) {
            filters.value[+i] = (await $api.dbTableLinkFilter.create(linkId || linkColId.value, {
              ...filter,
              children: undefined,
              fk_parent_id: parentId.value,
            } as FilterType)) as ColumnFilterType
          } else {
            filters.value[+i] = (await $api.dbTableFilter.create(
              view?.value?.id as string,
              {
                ...filter,
                fk_parent_id: parentId.value,
              } as FilterType,
            )) as ColumnFilterType
          }

          if (children) filters.value[+i].children = children

          if (!isLink && !isWebhook) allFilters.value.push(filters.value[+i] as FilterType)
        }
      }

      if (!isWebhook && !isLink) reloadData?.()
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdateDebounced = useCachedDebouncedFunction(saveOrUpdate, 500, (_filter: ColumnFilterType, i: number) => i)

  async function saveOrUpdate(filter: ColumnFilterType, i: number, force = false, undo = false, skipDataReload = false) {
    // if already in progress the debounced function which will call this function again with 500ms delay until it's not saving
    if (savingStatus[i]) {
      return saveOrUpdateDebounced(filter, i, force, undo, skipDataReload)
    }
    // wait if any previous filter save is in progress, it's to avoid messing up the order of filters
    else if (Array.from({ length: i }).some((_, index) => savingStatus[index])) {
      return saveOrUpdateDebounced(filter, i, force, undo, skipDataReload)
    }
    savingStatus[i] = true

    if (!view.value && !linkColId?.value) return

    if (!undo && !(isForm.value && !isWebhook)) {
      const lastFilter = lastFilters.value[i]
      if (lastFilter) {
        const delta = clone(getFieldDelta(filter, lastFilter))
        if (Object.keys(delta).length > 0) {
          addUndo({
            undo: {
              fn: (prop: string, data: any) => {
                const f = filters.value[i]
                if (f) {
                  f[prop as keyof ColumnFilterType] = data
                  saveOrUpdate(f, i, force, true)
                }
              },
              args: [Object.keys(delta)[0], Object.values(delta)[0]],
            },
            redo: {
              fn: (prop: string, data: any) => {
                const f = filters.value[i]
                if (f) {
                  f[prop as keyof ColumnFilterType] = data
                  saveOrUpdate(f, i, force, true)
                }
              },
              args: [Object.keys(delta)[0], filter[Object.keys(delta)[0] as keyof ColumnFilterType]],
            },
            scope: defineViewScope({ view: activeView.value }),
          })
        }
      }
    }
    try {
      if (nestedMode.value) {
        filters.value[i] = { ...filter }
        filters.value = [...filters.value]
      } else if (!autoApply?.value && !force) {
        filter.status = filter.id ? 'update' : 'create'
      } else if (filters.value[i]?.id && filters.value[i]?.status !== 'create') {
        await $api.dbTableFilter.update(filters.value[i].id!, {
          ...filter,
          fk_parent_id: parentId.value,
        })
        $e('a:filter:update', {
          logical: filter.logical_op,
          comparison: filter.comparison_op,
          link: !!isLink,
          webHook: !!isWebhook,
        })
      } else {
        if (linkColId?.value) {
          const savedFilter = await $api.dbTableLinkFilter.create(linkColId.value, {
            ...filter,
            fk_parent_id: parentId.value,
          })
          // extract id from saved filter and update the filter object
          // avoiding whole object update to prevent overwriting of current filter object changes
          filters.value[i] = {
            ...filters.value[i],
            fk_parent_id: parentId.value,
            id: savedFilter.id,
            status: undefined,
          }
        } else {
          const savedFilter = await $api.dbTableFilter.create(view.value!.id!, {
            ...filter,
            fk_parent_id: parentId.value,
          })
          // extract id from saved filter and update the filter object
          // avoiding whole object update to prevent overwriting of current filter object changes
          filters.value[i] = {
            ...filters.value[i],
            fk_parent_id: parentId.value,
            id: savedFilter.id,
            status: undefined,
          }
        }
        if (!isLink && !isWebhook) allFilters.value.push(filters.value[+i] as FilterType)
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      savingStatus[i] = false
    }

    lastFilters.value = clone(filters.value)

    if (!isWebhook && !skipDataReload && !isLink) reloadData?.()
  }

  function deleteFilterGroupFromAllFilters(filter: ColumnFilterType) {
    if (!isLink && !isWebhook) return

    // Find all child filters of the specified parentId
    const childFilters = allFilters.value.filter((f) => f.fk_parent_id === filter.id)

    // Recursively delete child filter of child filter
    childFilters.forEach((childFilter) => {
      if (childFilter.is_group) {
        deleteFilterGroupFromAllFilters(childFilter as ColumnFilterType)
      }
    })

    // Remove the parent object and its children from the array
    allFilters.value = allFilters.value.filter((f) => f.id !== filter.id && f.fk_parent_id !== filter.id)
  }

  const deleteFilter = async (filter: ColumnFilterType, i: number, undo = false) => {
    // update the filter status
    filter.status = 'delete'
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
    if (nestedMode.value) {
      filters.value.splice(i, 1)
      filters.value = [...filters.value]
      if (!isWebhook && !isLink) reloadData?.()
    } else {
      if (filter.id) {
        // if auto-apply disabled mark it as disabled
        if (!autoApply?.value) {
          filter.status = 'delete'
          // if auto-apply enabled invoke delete api and remove from array
          // no splice is required here
        } else {
          try {
            await $api.dbTableFilter.delete(filter.id)
            if (!isWebhook && !isLink) reloadData?.()

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
      $e('a:filter:delete', { length: nonDeletedFilters.value.length, link: !!isLink, webHook: !!isWebhook })
    }

    if (filter.is_group) {
      deleteFilterGroupFromAllFilters(filter)
    } else {
      if (!isLink && !isWebhook) allFilters.value = allFilters.value.filter((f) => f.id !== filter.id)
    }
  }
  const addFilter = async (undo = false, draftFilter: Partial<FilterType> = {}) => {
    filters.value.push(
      (draftFilter?.fk_column_id ? { ...placeholderFilter(), ...draftFilter } : placeholderFilter()) as ColumnFilterType,
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

    lastFilters.value = clone(filters.value)

    $e('a:filter:add', { length: filters.value.length, link: !!isLink, webHook: !!isWebhook })
  }

  const addFilterGroup = async () => {
    const child = placeholderFilter()

    const placeHolderGroupFilter: ColumnFilterType = placeholderGroupFilter()

    if (nestedMode.value) placeHolderGroupFilter.children = [child]

    filters.value.push(placeHolderGroupFilter)

    const index = filters.value.length - 1

    await saveOrUpdate(filters.value[index], index)

    lastFilters.value = clone(filters.value)

    $e('a:filter:add', { length: filters.value.length, group: true, link: !!isLink, webHook: !!isWebhook })
  }

  /** on column delete reload filters, identify by checking columns count */
  watch(
    () => {
      if (!view?.value || !metas?.value?.[view?.value?.fk_model_id as string]) {
        return 0
      }

      return metas?.value?.[view?.value?.fk_model_id as string]?.columns?.length || 0
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
        // check all the relation of nested lookup columns is bt or not
        // include the column only if all only if all relations are bt
        while (nextCol && nextCol.uidt === UITypes.Lookup) {
          // extract the relation column meta
          const lookupRelation = (await getMeta(nextCol.fk_model_id!))?.columns?.find(
            (c) => c.id === (nextCol!.colOptions as LookupType).fk_relation_column_id,
          )

          // this is less likely to happen but if relation column is not found then break the loop
          if (!lookupRelation) {
            break
          }

          const relatedTableMeta = await getMeta((lookupRelation?.colOptions as LinkToAnotherRecordType).fk_related_model_id!)
          nextCol = relatedTableMeta?.columns?.find((c) => c.id === (nextCol!.colOptions as LookupType).fk_lookup_column_id)

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

  return {
    filters,
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
  }
}
