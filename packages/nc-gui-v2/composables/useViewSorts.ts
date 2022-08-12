import type { GalleryType, GridType, KanbanType, SortType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useNuxtApp } from '#imports'
import { IsPublicInj, ReloadViewDataHookInj } from '~/context'

export function useViewSorts(
  view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined,
  reloadData?: () => void,
) {
  const _sorts = ref<SortType[]>([])
  const { sorts: sharedViewSorts, sharedView } = useSharedView()

  const reloadHook = inject(ReloadViewDataHookInj)
  const isPublic = inject(IsPublicInj, ref(false))

  const sorts = computed<SortType[]>({
    get: () => (isPublic.value ? sharedViewSorts.value : _sorts.value),
    set: (value) => {
      if (isPublic.value) {
        sharedViewSorts.value = value
      } else {
        _sorts.value = value
      }
      reloadHook?.trigger()
    },
  })

  const { $api } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const loadSorts = async () => {
    if (isPublic.value) {
      const sharedSorts = sharedView.value?.sorts || []
      sorts.value = [...sharedSorts]
      return
    }
    if (!view?.value) return
    sorts.value = ((await $api.dbTableSort.list(view?.value?.id as string)) as any)?.sorts?.list
  }

  const saveOrUpdate = async (sort: SortType, i: number) => {
    // TODO:
    // if (!this.shared && this._isUIAllowed('sortSync')) {
    if (isPublic.value) {
      sorts.value[i] = sort
      sorts.value = [...sorts.value]
      return
    }

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
    sorts.value = [
      ...sorts.value,
      {
        direction: 'asc',
      },
    ]
  }

  const deleteSort = async (sort: SortType, i: number) => {
    // TOOD:
    // if (!this.shared && sort.id && this._isUIAllowed('sortSync')) {
    if (isPublic.value) {
      sorts.value.splice(i, 1)
      sorts.value = [...sorts.value]
      return
    }

    if (isUIAllowed('sortSync') && sort.id) {
      await $api.dbTableSort.delete(sort.id)
    } else {
      sorts.value.splice(i, 1)
    }
  }
  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate }
}
