import type { ColumnType, FilterType, LinkToAnotherRecordType, LookupType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsPublicInj,
  MetaInj,
  computed,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  storeToRefs,
  useBase,
  useDebounceFn,
  useMetas,
  useNuxtApp,
  useRoles,
  watch,
} from '#imports'
import type { Filter, UndoRedoAction } from '#imports'

export function useViewFilters(
  view: Ref<ViewType | undefined>,
  parentId?: string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
  _currentFilters?: Filter[],
  isNestedRoot?: boolean,
  isWebhook?: boolean,
) {
  const currentFilters = ref(_currentFilters)

  const btLookupTypesMap = ref({})

  const reloadHook = inject(ReloadViewDataHookInj)

  const { nestedFilters } = useSmartsheetStoreOrThrow()

  const { baseMeta } = storeToRefs(useBase())

  const isPublic = inject(IsPublicInj, ref(false))

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { metas, getMeta } = useMetas()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const _filters = ref<Filter[]>([])

  const nestedMode = computed(() => isPublic.value || !isUIAllowed('filterSync') || !isUIAllowed('filterChildrenRead'))

  const filters = computed<Filter[]>({
    get: () => {
      return nestedMode.value ? currentFilters.value! : _filters.value
    },
    set: (value: Filter[]) => {
      if (nestedMode.value) {
        currentFilters.value = value
        if (isNestedRoot) {
          nestedFilters.value = value
        }
        nestedFilters.value = [...nestedFilters.value]
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
      // if column is a lookup column, then use the lookup type extracted from the column
      if (btLookupTypesMap.value[col.id]) {
        obj[col.id] = btLookupTypesMap.value[col.id].uidt
      } else {
        obj[col.id] = col.uidt
      }
      return obj
    }, {})
  })

  const lastFilters = ref<Filter[]>([])

  watchOnce(filters, (filters: Filter[]) => {
    lastFilters.value = clone(filters)
  })

  // get delta between two objects and return the changed fields (value is from b)
  const getFieldDelta = (a: any, b: any) => {
    return Object.entries(b)
      .filter(([key, val]) => a[key] !== val && key in a)
      .reduce((a, [key, v]) => ({ ...a, [key]: v }), {})
  }

  const isComparisonOpAllowed = (
    filter: FilterType,
    compOp: {
      text: string
      value: string
      ignoreVal?: boolean
      includedTypes?: UITypes[]
      excludedTypes?: UITypes[]
    },
  ) => {
    const isNullOrEmptyOp = ['empty', 'notempty', 'null', 'notnull'].includes(compOp.value)
    if (compOp.includedTypes) {
      // include allowed values only if selected column type matches
      if (filter.fk_column_id && compOp.includedTypes.includes(types.value[filter.fk_column_id])) {
        // for 'empty', 'notempty', 'null', 'notnull',
        // show them based on `showNullAndEmptyInFilter` in Base Settings
        return isNullOrEmptyOp ? baseMeta.value.showNullAndEmptyInFilter : true
      } else {
        return false
      }
    } else if (compOp.excludedTypes) {
      // include not allowed values only if selected column type not matches
      if (filter.fk_column_id && !compOp.excludedTypes.includes(types.value[filter.fk_column_id])) {
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
    filter: FilterType,
    compOp: {
      text: string
      value: string
      ignoreVal?: boolean
      includedTypes?: UITypes[]
      excludedTypes?: UITypes[]
    },
  ) => {
    if (compOp.includedTypes) {
      // include allowed values only if selected column type matches
      return filter.fk_column_id && compOp.includedTypes.includes(types.value[filter.fk_column_id])
    } else if (compOp.excludedTypes) {
      // include not allowed values only if selected column type not matches
      return filter.fk_column_id && !compOp.excludedTypes.includes(types.value[filter.fk_column_id])
    }
  }

  const placeholderFilter = (): Filter => {
    return {
      comparison_op: comparisonOpList(options.value?.[0].uidt as UITypes).filter((compOp) =>
        isComparisonOpAllowed({ fk_column_id: options.value?.[0].id }, compOp),
      )?.[0].value as FilterType['comparison_op'],
      value: '',
      status: 'create',
      logical_op: 'and',
    }
  }

  const loadFilters = async (hookId?: string) => {
    if (!view.value?.id) return

    if (nestedMode.value) {
      // ignore restoring if not root filter group
      return
    }

    try {
      if (hookId) {
        if (parentId) {
          filters.value = (await $api.dbTableFilter.childrenRead(parentId)).list as Filter[]
        } else {
          filters.value = (await $api.dbTableWebhookFilter.read(hookId!)).list as Filter[]
        }
      } else {
        if (parentId) {
          filters.value = (await $api.dbTableFilter.childrenRead(parentId)).list as Filter[]
        } else {
          filters.value = (await $api.dbTableFilter.read(view.value!.id!)).list as Filter[]
        }
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const sync = async (hookId?: string, _nested = false) => {
    try {
      for (const [i, filter] of Object.entries(filters.value)) {
        if (filter.status === 'delete') {
          await $api.dbTableFilter.delete(filter.id as string)
        } else if (filter.status === 'update') {
          await $api.dbTableFilter.update(filter.id as string, {
            ...filter,
            fk_parent_id: parentId,
          })
        } else if (filter.status === 'create') {
          if (hookId) {
            filters.value[+i] = (await $api.dbTableWebhookFilter.create(hookId, {
              ...filter,
              fk_parent_id: parentId,
            })) as unknown as FilterType
          } else {
            filters.value[+i] = await $api.dbTableFilter.create(view?.value?.id as string, {
              ...filter,
              fk_parent_id: parentId,
            })
          }
        }
      }

      if (!isWebhook) reloadData?.()
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdate = async (filter: Filter, i: number, force = false, undo = false) => {
    if (!view.value) return

    if (!undo) {
      const lastFilter = lastFilters.value[i]
      if (lastFilter) {
        const delta = clone(getFieldDelta(filter, lastFilter))
        if (Object.keys(delta).length > 0) {
          addUndo({
            undo: {
              fn: (prop: string, data: any) => {
                const f = filters.value[i]
                if (f) {
                  f[prop as keyof Filter] = data
                  saveOrUpdate(f, i, force, true)
                }
              },
              args: [Object.keys(delta)[0], Object.values(delta)[0]],
            },
            redo: {
              fn: (prop: string, data: any) => {
                const f = filters.value[i]
                if (f) {
                  f[prop as keyof Filter] = data
                  saveOrUpdate(f, i, force, true)
                }
              },
              args: [Object.keys(delta)[0], filter[Object.keys(delta)[0] as keyof Filter]],
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
      } else if (filter.id && filter.status !== 'create') {
        await $api.dbTableFilter.update(filter.id, {
          ...filter,
          fk_parent_id: parentId,
        })
        $e('a:filter:update', {
          logical: filter.logical_op,
          comparison: filter.comparison_op,
        })
      } else {
        filters.value[i] = await $api.dbTableFilter.create(view.value.id!, {
          ...filter,
          fk_parent_id: parentId,
        })
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }

    lastFilters.value = clone(filters.value)

    if (!isWebhook) reloadData?.()
  }

  const deleteFilter = async (filter: Filter, i: number, undo = false) => {
    if (!undo && !filter.is_group) {
      addUndo({
        undo: {
          fn: async (fl: Filter) => {
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
      if (!isWebhook) reloadData?.()
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
            if (!isWebhook) reloadData?.()
            filters.value.splice(i, 1)
          } catch (e: any) {
            console.log(e)
            message.error(await extractSdkResponseErrorMsg(e))
          }
        }
        // if not synced yet remove it from array
      } else {
        filters.value.splice(i, 1)
      }
      $e('a:filter:delete', { length: nonDeletedFilters.value.length })
    }
  }

  const saveOrUpdateDebounced = useDebounceFn(saveOrUpdate, 500)

  const addFilter = async (undo = false) => {
    filters.value.push(placeholderFilter())
    if (!undo) {
      addUndo({
        undo: {
          fn: async function undo(this: UndoRedoAction, i: number) {
            this.redo.args = [i, clone(filters.value[i])]
            await deleteFilter(filters.value[i], i, true)
          },
          args: [filters.value.length - 1],
        },
        redo: {
          fn: async (i: number, fl: Filter) => {
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

    $e('a:filter:add', { length: filters.value.length })
  }

  const addFilterGroup = async () => {
    const child = placeholderFilter()

    const placeHolderGroupFilter: Filter = {
      is_group: true,
      status: 'create',
      logical_op: 'and',
    }

    if (nestedMode.value) placeHolderGroupFilter.children = [child]

    filters.value.push(placeHolderGroupFilter)

    const index = filters.value.length - 1

    await saveOrUpdate(filters.value[index], index, true)

    lastFilters.value = clone(filters.value)

    $e('a:filter:add', { length: filters.value.length, group: true })
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
    const btLookupTypes = {}
    try {
      for (const col of meta.value?.columns || []) {
        if (col.uidt !== UITypes.Lookup) continue
        let nextCol = col
        // check all the relation of nested lookup columns is bt or not
        // include the column only if all only if all relations are bt
        while (nextCol && nextCol.uidt === UITypes.Lookup) {
          // extract the relation column meta
          const lookupRelation = (await getMeta(nextCol.fk_model_id))?.columns?.find(
            (c) => c.id === (nextCol.colOptions as LookupType).fk_relation_column_id,
          )
          const relatedTableMeta = await getMeta((lookupRelation.colOptions as LinkToAnotherRecordType).fk_related_model_id)
          nextCol = relatedTableMeta?.columns?.find((c) => c.id === (nextCol.colOptions as LookupType).fk_lookup_column_id)

          // if next column is same as root lookup column then break the loop
          // since it's going to be a circular loop
          if (nextCol.id === col.id) {
            break
          }
        }
        btLookupTypes[col.id] = nextCol
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
  }
}
