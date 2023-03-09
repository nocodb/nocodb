import type { SortType, ViewType } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import {
  IsPublicInj,
  ReloadViewDataHookInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  useNuxtApp,
  useProject,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'
import type { TabItem } from '~/lib'

export function useViewSorts(view: Ref<ViewType | undefined>, reloadData?: () => void) {
  const { sharedView } = useSharedView()

  const { sorts } = useSmartsheetStoreOrThrow()

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const { isSharedBase } = storeToRefs(useProject())

  const reloadHook = inject(ReloadViewDataHookInj)

  const isPublic = inject(IsPublicInj, ref(false))

  const tabMeta = inject(TabMetaInj, ref({ sortsState: new Map() } as TabItem))

  const loadSorts = async () => {
    if (isPublic.value) {
      // todo: sorts missing on `ViewType`
      const sharedSorts = (sharedView.value as any)?.sorts || []
      sorts.value = [...sharedSorts]
      return
    }

    try {
      if (!isUIAllowed('sortSync')) {
        const sortsBackup = tabMeta.value.sortsState!.get(view.value!.id!)
        if (sortsBackup) {
          sorts.value = sortsBackup
          return
        }
      }
      if (!view?.value) return
      sorts.value = (await $api.dbTableSort.list(view.value!.id!)).sorts?.list || []
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdate = async (sort: SortType, i: number) => {
    if (isPublic.value || isSharedBase.value) {
      sorts.value[i] = sort
      sorts.value = [...sorts.value]
      reloadHook?.trigger()
      tabMeta.value.sortsState!.set(view.value!.id!, sorts.value)
      return
    }

    try {
      if (isUIAllowed('sortSync')) {
        if (sort.id) {
          await $api.dbTableSort.update(sort.id, sort)
          $e('sort-updated')
        } else {
          sorts.value[i] = (await $api.dbTableSort.create(view.value?.id as string, sort)) as unknown as SortType
        }
      }
      reloadData?.()
      $e('a:sort:dir', { direction: sort.direction })
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

    $e('a:sort:add', { length: sorts?.value?.length })

    tabMeta.value.sortsState!.set(view.value!.id!, sorts.value)
  }

  const deleteSort = async (sort: SortType, i: number) => {
    try {
      if (isUIAllowed('sortSync') && sort.id && !isPublic.value && !isSharedBase.value) {
        await $api.dbTableSort.delete(sort.id)
      }
      sorts.value.splice(i, 1)
      sorts.value = [...sorts.value]

      tabMeta.value.sortsState!.set(view.value!.id!, sorts.value)

      reloadHook?.trigger()
      $e('a:sort:delete')
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate }
}
