import type { GalleryType, GridType, KanbanType, SortType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#imports'

export function useViewSorts(
  view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined,
  reloadData?: () => void,
) {
  const sorts = ref<SortType[]>([])

  const { $api } = useNuxtApp()

  const loadSorts = async () => {
    if (!view?.value) return
    // todo: api correction
    sorts.value = ((await $api.dbTableSort.list(view?.value?.id as string)) as any)?.sorts?.list as any[]
  }

  const saveOrUpdate = async (sort: SortType, i: number) => {
    if (!sorts?.value) return
    if (sort.id) {
      await $api.dbTableSort.update(sort.id, sort)
    } else {
      sorts.value[i] = (await $api.dbTableSort.create(view?.value?.id as string, sort)) as any
    }
    reloadData?.()
  }
  const addSort = () => {
    sorts.value.push({
      direction: 'asc',
    })
  }

  const deleteSort = async (sort: SortType, i: number) => {
    // if (!this.shared && sort.id && this._isUIAllowed('sortSync')) {
    if (sort.id) {
      await $api.dbTableSort.delete(sort.id)
    }
    sorts.value.splice(i, 1)
  }
  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate }
}
