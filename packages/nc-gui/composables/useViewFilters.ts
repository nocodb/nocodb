import type { FilterType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import {
  IsPublicInj,
  computed,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  useDebounceFn,
  useMetas,
  useNuxtApp,
  useUIPermission,
  watch,
} from '#imports'
import { TabMetaInj } from '~/context'
import type { Filter, TabItem } from '~/lib'

export function useViewFilters(
  view: Ref<ViewType | undefined>,
  parentId?: string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
  _currentFilters?: Filter[],
  isNestedRoot?: boolean,
) {
  let currentFilters = $ref(_currentFilters)

  const reloadHook = inject(ReloadViewDataHookInj)

  const { nestedFilters } = useSmartsheetStoreOrThrow()

  const isPublic = inject(IsPublicInj, ref(false))

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const { metas } = useMetas()

  const _filters = ref<Filter[]>([])

  const nestedMode = computed(() => isPublic.value || !isUIAllowed('filterSync') || !isUIAllowed('filterChildrenRead'))

  const tabMeta = inject(TabMetaInj, ref({ filterState: new Map(), sortsState: new Map() } as TabItem))

  const filters = computed<Filter[]>({
    get: () => {
      return nestedMode.value ? currentFilters! : _filters.value
    },
    set: (value: Filter[]) => {
      if (nestedMode.value) {
        currentFilters = value
        if (isNestedRoot) {
          nestedFilters.value = value
          tabMeta.value.filterState!.set(view.value!.id!, nestedFilters.value)
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

  const placeholderFilter: Filter = {
    comparison_op: 'eq',
    value: '',
    status: 'create',
    logical_op: 'and',
  }

  const loadFilters = async (hookId?: string) => {
    if (nestedMode.value) {
      // ignore restoring if not root filter group
      if (isNestedRoot) filters.value = tabMeta.value.filterState!.get(view.value!.id!) || []
      return
    }

    try {
      if (hookId) {
        if (parentId) {
          filters.value = await $api.dbTableFilter.childrenRead(parentId)
        } else {
          // todo: return type is incorrect
          filters.value = (await $api.dbTableWebhookFilter.read(hookId!)) as unknown as Filter[]
        }
      } else {
        if (parentId) {
          filters.value = await $api.dbTableFilter.childrenRead(parentId)
        } else {
          filters.value = await $api.dbTableFilter.read(view.value!.id!)
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

      reloadData?.()
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const deleteFilter = async (filter: Filter, i: number) => {
    // if shared or sync permission not allowed simply remove it from array
    if (nestedMode.value) {
      filters.value.splice(i, 1)
      filters.value = [...filters.value]
      reloadData?.()
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
            reloadData?.()
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

  const saveOrUpdate = async (filter: Filter, i: number, force = false) => {
    if (!view.value) return

    try {
      if (nestedMode.value) {
        filters.value[i] = { ...filter }
        filters.value = [...filters.value]
      } else if (!autoApply?.value && !force) {
        filter.status = filter.id ? 'update' : 'create'
      } else if (filter.id) {
        await $api.dbTableFilter.update(filter.id, {
          ...filter,
          fk_parent_id: parentId,
        })
        $e('a:filter:update', {
          logical: filter.logical_op,
          comparison: filter.comparison_op,
        })
      } else {
        // todo: return type of dbTableFilter is void?
        filters.value[i] = await $api.dbTableFilter.create(view.value.id!, {
          ...filter,
          fk_parent_id: parentId,
        })
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }

    reloadData?.()
  }

  const saveOrUpdateDebounced = useDebounceFn(saveOrUpdate, 500)

  const addFilter = () => {
    filters.value.push({ ...placeholderFilter })
    $e('a:filter:add', { length: filters.value.length })
  }

  const addFilterGroup = async () => {
    const child = { ...placeholderFilter }
    const placeHolderGroupFilter: Filter = {
      is_group: true,
      status: 'create',
      logical_op: 'and',
    }

    if (nestedMode.value) placeHolderGroupFilter.children = [child]

    filters.value.push(placeHolderGroupFilter)

    const index = filters.value.length - 1

    await saveOrUpdate(filters.value[index], index, true)

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
    async (nextColsLength, oldColsLength) => {
      if (nextColsLength && nextColsLength < oldColsLength) await loadFilters()
    },
  )

  return { filters, nonDeletedFilters, loadFilters, sync, deleteFilter, saveOrUpdate, addFilter, addFilterGroup, saveOrUpdateDebounced }
}
