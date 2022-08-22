import type { GalleryType, GridType, KanbanType, SortType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { message } from 'ant-design-vue'
import { IsPublicInj, ReloadViewDataHookInj, extractSdkResponseErrorMsg, useNuxtApp } from '#imports'

export function useViewSorts(
  view: Ref<(GridType | KanbanType | GalleryType) & { id?: string }> | undefined,
  reloadData?: () => void,
) {
  const { sharedView } = useSharedView()
  const { sorts } = useSmartsheetStoreOrThrow()

  const reloadHook = inject(ReloadViewDataHookInj)

  const isPublic = inject(IsPublicInj, ref(false))

  const { $api } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()
  const { isSharedBase } = useProject()

  const loadSorts = async () => {
    if (isPublic.value) {
      const sharedSorts = sharedView.value?.sorts || []
      sorts.value = [...sharedSorts]
      return
    }

    try {
      if (!view?.value) return
      sorts.value = ((await $api.dbTableSort.list(view?.value?.id as string)) as any)?.sorts?.list
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdate = async (sort: SortType, i: number) => {
    if (isPublic.value || isSharedBase.value) {
      sorts.value[i] = sort
      sorts.value = [...sorts.value]
      return
    }

    try {
      if (isUIAllowed('sortSync')) {
        if (sort.id) {
          await $api.dbTableSort.update(sort.id, sort)
        } else {
          sorts.value[i] = (await $api.dbTableSort.create(view?.value?.id as string, sort)) as any
        }
      }
      reloadData?.()
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
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
    try {
      if (isUIAllowed('sortSync') && sort.id && !isPublic.value && !isSharedBase.value) {
        await $api.dbTableSort.delete(sort.id)
      }
      sorts.value.splice(i, 1)
      sorts.value = [...sorts.value]
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  watch(sorts, () => {
    reloadHook?.trigger()
  })

  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate }
}
