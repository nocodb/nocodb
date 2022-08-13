import type { GalleryType, GridType, KanbanType, SortType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#imports'

export function useViewSorts(
  view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined,
  reloadData?: () => void,
) {
  const sorts = ref<SortType[]>([])

  const { $api } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const loadSorts = async () => {
    if (!view?.value) return
    sorts.value = ((await $api.dbTableSort.list(view?.value?.id as string)) as any)?.sorts?.list
  }

  const saveOrUpdate = async (sort: SortType, i: number) => {
    // TODO:
    // if (!this.shared && this._isUIAllowed('sortSync')) {
    if (isUIAllowed('sortSync')) {
      if (sort.id) {
        await $api.dbTableSort.update(sort.id, sort)
      } else {
        sorts.value[i] = (await $api.dbTableSort.create(view?.value?.id as string, sort)) as any
      }
    }
    reloadData?.()
  }
  const addSort = () => {
    sorts.value.push({
      direction: 'asc',
    })
  }

  const deleteSort = async (sort: SortType, i: number) => {
    // TOOD:
    // if (!this.shared && sort.id && this._isUIAllowed('sortSync')) {
    if (isUIAllowed('sortSync') && sort.id) {
      await $api.dbTableSort.delete(sort.id)
    } else {
      sorts.value.splice(i, 1)
    }
  }
  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate }
}
