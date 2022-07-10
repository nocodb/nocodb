import type { FilterType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#imports'

export default function (view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined, parentId?: string) {
  const filters = ref<(FilterType & { status?: 'update' | 'delete' })[]>([])

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
  }

  const deleteFilter = async (filter: FilterType, i: number) => {
    //   if (this.shared || !this._isUIAllowed('filterSync')) {
    //     this.filters.splice(i, 1)
    //     this.$emit('updated')
    //   } else if (filter.id) {
    //     if (!this.autoApply) {
    //       this.$set(filter, 'status', 'delete')
    //     } else {
    //       await this.$api.dbTableFilter.delete(filter.id)
    //       await this.loadFilter()
    //       this.$emit('updated')
    //     }
    //   } else {
    //     this.filters.splice(i, 1)
    //     this.$emit('updated')
    //   }
    //   this.$e('a:filter:delete')
    // // },
  }

  const saveOrUpdate = async (filter: FilterType, i: number) => {
    //   if (this.shared || !this._isUIAllowed('filterSync')) {
    //     this.filters.splice(i, 1)
    //     this.$emit('updated')
    //   } else if (filter.id) {
    //     if (!this.autoApply) {
    //       this.$set(filter, 'status', 'delete')
    //     } else {
    //       await this.$api.dbTableFilter.delete(filter.id)
    //       await this.loadFilter()
    //       this.$emit('updated')
    //     }
    //   } else {
    //     this.filters.splice(i, 1)
    //     this.$emit('updated')
    //   }
    //   this.$e('a:filter:delete')
    // // },
  }

  return { filters, loadFilters, sync, deleteFilter, saveOrUpdate }
}
