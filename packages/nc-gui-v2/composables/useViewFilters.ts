import type {FilterType, GalleryType, GridType, KanbanType} from 'nocodb-sdk'
import type {ComputedRef, Ref} from 'vue'
import {useNuxtApp} from '#imports'
import useUIPermission from '~/composables/useUIPermission'

export function useViewFilters(
  view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined,
  parentId?: string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
  shared = false
) {

  // todo: update swagger
  const filters = ref<(FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string })[]>([])

  const {$api} = useNuxtApp()
  const {isUIAllowed} = useUIPermission()

  const loadFilters = async () => {
    if (parentId) {
      filters.value = await $api.dbTableFilter.childrenRead(parentId)
    } else {
      filters.value = await $api.dbTableFilter.read(view?.value?.id as string)
    }
  }

  const sync = async (_nested = false) => {
    for (const [i, filter] of Object.entries(filters.value)) {
      if (filter.status === 'delete') {
        await $api.dbTableFilter.delete(filter.id as string)
      } else if (filter.status === 'update') {
        await $api.dbTableFilter.update(filter.id as string, {
          ...filter,
          fk_parent_id: parentId,
        })
      } else if (filter.status === 'create') {
        filters.value[+i] = (await $api.dbTableFilter.create(view?.value?.id as string, {
          ...filter,
          fk_parent_id: parentId,
        })) as any
      }
    }
    reloadData?.()
  }

  const deleteFilter = async (filter: FilterType & { status: string }, i: number) => {

    if (shared || !isUIAllowed('filterSync')) {
      const _filters = unref(filters.value)
      _filters.splice(i, 1)
      filters.value = _filters
    } else if (filter.id) {
      if (!autoApply?.value) {
        filter.status = 'delete'
      } else {
        await $api.dbTableFilter.delete(filter.id)
        const _filters = unref(filters.value)
        _filters.splice(i, 1)
        filters.value = _filters
        reloadData?.()
      }
    }
  }

  const saveOrUpdate = async (filter: FilterType & { status?: string }, i: number, force = false) => {
    if (!view?.value) return
    if (shared || !isUIAllowed('filterSync')) {
      // skip
    } else if (!autoApply?.value && !force) {
      filter.status = filter.id ? 'update' : 'create'
    } else if (filter.id) {
      await $api.dbTableFilter.update(filter.id, {
        ...filter,
        fk_parent_id: parentId,
      })
    } else {
      // todo: return type correction
      filters.value[i] = (await $api.dbTableFilter.create(view?.value?.id as string, {
        ...filter,
        fk_parent_id: parentId,
      })) as any
    }
    reloadData?.()
  }

  const addFilter = () => {
    filters.value.push({
      comparison_op: 'eq',
      value: '',
      status: 'create',
      logical_op: 'and',
    })
  }

  const addFilterGroup = async (parentId?: string) => {
    filters.value.push({
      parentId,
      is_group: true,
      status: 'create',
      logical_op: 'and',
    })
    const index = filters.value.length - 1
    await saveOrUpdate(filters.value[index], index, true)
  }

  return {filters, loadFilters, sync, deleteFilter, saveOrUpdate, addFilter, addFilterGroup}
}
