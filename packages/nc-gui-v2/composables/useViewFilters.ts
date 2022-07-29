import type { FilterType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { useNuxtApp } from '#imports'

export function useViewFilters(
  view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined,
  parentId?: string,
  autoApply?: ComputedRef<boolean>,
  reloadData?: () => void,
) {
  // todo: update swagger
  const filters = ref<(FilterType & { status?: 'update' | 'delete'; parentId?: string })[]>([])

  const { $api } = useNuxtApp()

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
      } else {
        filters.value[+i] = (await $api.dbTableFilter.create(view?.value?.id as string, {
          ...filter,
          fk_parent_id: parentId,
        })) as any
      }
    }
    reloadData?.()
  }

  const deleteFilter = async (filter: FilterType & { status: string }, i: number) => {
    //   if (this.shared || !this._isUIAllowed('filterSync')) {
    //     this.filters.splice(i, 1)
    //     this.$emit('updated')
    //   } else

    if (filter.id) {
      if (!autoApply?.value) {
        filter.status = 'delete'
      } else {
        await $api.dbTableFilter.delete(filter.id) /**/
        //       await this.loadFilter()
        //       this.$emit('updated')
      }
    } else {
      //     this.$emit('updated')
    }
    const _filters = unref(filters.value)
    _filters.splice(i, 1)
    filters.value = _filters
    //   this.$e('a:filter:delete')
    // // },
    reloadData?.()
  }

  const saveOrUpdate = async (filter: FilterType & { status?: string }, i: number) => {
    if (!view?.value) return

    // if (this.shared || !this._isUIAllowed('filterSync')) {
    // this.$emit('input', this.filters.filter(f => f.fk_column_id && f.comparison_op))
    // this.$emit('updated')
    // } else
    if (!autoApply?.value) {
      filter.status = 'update'
    } else if (filter.id) {
      await $api.dbTableFilter.update(filter.id, {
        ...filter,
        fk_parent_id: parentId,
      })

      // this.$emit('updated')
    } else {
      // todo: return type correction
      filters.value[i] = (await $api.dbTableFilter.create(view?.value?.id as string, {
        ...filter,
        fk_parent_id: parentId,
      })) as any

      // this.$emit('updated')
    }
    reloadData?.()
  }

  const addFilter = () => {
    filters.value.push({
      comparison_op: 'eq',
      value: '',
      status: 'update',
      logical_op: 'and',
    })
  }

  const addFilterGroup = async (parentId?: string) => {
    filters.value.push({
      parentId,
      is_group: true,
      status: 'update',
      logical_op: 'and',
    })
    const index = filters.value.length - 1
    await saveOrUpdate(filters.value[index], index)
  }

  return { filters, loadFilters, sync, deleteFilter, saveOrUpdate, addFilter, addFilterGroup }
}
