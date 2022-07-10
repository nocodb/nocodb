import type { GalleryType, GridType, KanbanType, SortType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#imports'

export default function (view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }>) {
  const sorts = ref<SortType[]>([])

  const { $api } = useNuxtApp()

  const loadSorts = async () => {
    sorts.value = (await $api.dbTableSort.list(view?.value?.id as string)) as any[]
  }

  const sync = async (sort: SortType, i: number) => {
    if (!sorts?.value) return
    if (sort.id) {
      await $api.dbTableSort.update(sort.id, sort)
    } else {
      sorts.value[i] = (await $api.dbTableSort.create(view?.value?.id as string, sort)) as any
    }
  }

  return { sorts, loadSorts, sync }
}
