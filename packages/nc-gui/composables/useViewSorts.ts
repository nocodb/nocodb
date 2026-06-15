import type { ColumnType, SortType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { EventHook } from '@vueuse/core'

export function useViewSorts(view: Ref<ViewType | undefined>, reloadData?: () => void) {
  const { sorts, eventBus } = useSmartsheetStoreOrThrow()

  const { $api, $e, $eventBus } = useNuxtApp()

  const { internalGet } = useInternalBatch()

  const { isSharedBase } = storeToRefs(useBase())

  const { hasPersonalViewPermission } = usePersonalViewPermissions(view)

  const canSyncSort = hasPersonalViewPermission('sortSync')

  const canListSort = hasPersonalViewPermission('sortList')

  const reloadHook = inject(ReloadViewDataHookInj)

  const isPublic = inject(IsPublicInj, ref(false))

  const meta = inject(MetaInj, ref())

  const loadSorts = async () => {
    if (isPublic.value) {
      sorts.value = []
      return
    }

    // Wait for meta to be available before loading sorts (up to 5 seconds)
    if (!meta.value && view?.value) {
      await until(meta).toBeTruthy({ timeout: 5000 })
    }

    try {
      if (!canListSort.value) {
        return
      }
      if (!view?.value || !meta.value) return

      sorts.value = (
        await internalGet(meta.value.fk_workspace_id!, meta.value.base_id!, {
          operation: 'sortList',
          viewId: view.value!.id!,
        })
      ).list as SortType[]
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
      return
    }

    try {
      if (canSyncSort.value) {
        const sortBody = {
          fk_column_id: sort.fk_column_id,
          direction: sort.direction,
          ...((sort as { fk_level_id?: string | null }).fk_level_id !== undefined
            ? { fk_level_id: (sort as { fk_level_id?: string | null }).fk_level_id }
            : {}),
        }
        if (sort.id) {
          await $api.internal.postOperation(
            meta.value!.fk_workspace_id!,
            meta.value!.base_id!,
            {
              operation: 'sortUpdate',
              sortId: sort.id,
            },
            sortBody,
          )
          $e('sort-updated')
        } else {
          sorts.value[i] = (await $api.internal.postOperation(
            meta.value!.fk_workspace_id!,
            meta.value!.base_id!,
            {
              operation: 'sortCreate',
              viewId: view.value?.id as string,
            },
            sortBody,
          )) as unknown as SortType
        }
      }
      reloadData?.()
      $e('a:sort:dir', { direction: sort.direction })
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const insertSort = async ({
    direction,
    column,
    reloadDataHook,
  }: {
    direction: 'asc' | 'desc'
    column: ColumnType
    reloadDataHook?: EventHook<boolean | void> | undefined
  }) => {
    try {
      $e('a:sort:add', { from: 'column-menu' })
      const existingSortIndex = sorts.value.findIndex((s) => s.fk_column_id === column.id)
      const existingSort = existingSortIndex > -1 ? sorts.value[existingSortIndex] : undefined

      const isLocalMode = isPublic.value || isSharedBase.value || !canSyncSort.value
      // Delete existing sort and not update the state as sort count in UI will change for a sec
      if (existingSort && !isLocalMode) {
        await $api.internal.postOperation(
          meta.value!.fk_workspace_id!,
          meta.value!.base_id!,
          {
            operation: 'sortDelete',
            sortId: existingSort.id!,
          },
          {},
        )
        $e('a:sort:delete')
      }

      let data: any

      if (isLocalMode) {
        data = {
          fk_column_id: column!.id,
          direction,
        }
      } else {
        data = await $api.internal.postOperation(
          meta.value!.fk_workspace_id!,
          meta.value!.base_id!,
          {
            operation: 'sortCreate',
            viewId: view.value?.id as string,
          },
          {
            fk_column_id: column!.id,
            direction,
          },
        )
      }

      sorts.value = [...sorts.value.filter((_, index) => index !== existingSortIndex), data as SortType]

      eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
      reloadDataHook?.trigger()
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function deleteSort(sort: SortType, i: number) {
    try {
      const isLocalMode = isPublic.value || isSharedBase.value || !canSyncSort.value
      if (sort.id && !isLocalMode) {
        await $api.internal.postOperation(
          meta.value!.fk_workspace_id!,
          meta.value!.base_id!,
          {
            operation: 'sortDelete',
            sortId: sort.id,
          },
          {},
        )
      }
      sorts.value.splice(i, 1)
      sorts.value = [...sorts.value]

      reloadHook?.trigger()
      $e('a:sort:delete')
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const addSort = (column?: ColumnType) => {
    sorts.value = [
      ...sorts.value,
      {
        fk_column_id: column?.id,
        direction: 'asc',
      },
    ]

    $e('a:sort:add', { length: sorts?.value?.length })
  }

  const evtListener = (evt: string, payload: any) => {
    if (payload.fk_view_id !== view.value?.id) return

    if (evt === 'sort_create') {
      sorts.value.push(payload)
      reloadHook?.trigger()
    } else if (evt === 'sort_update') {
      const index = sorts.value.findIndex((s) => s.id === payload.id)
      if (index !== -1) {
        sorts.value[index] = payload
      }
      reloadHook?.trigger()
    } else if (evt === 'sort_delete') {
      sorts.value = sorts.value.filter((s) => s.id !== payload.id)
      reloadHook?.trigger()
    }
  }

  onMounted(() => {
    $eventBus.realtimeViewMetaEventBus.on(evtListener)
  })

  onBeforeUnmount(() => {
    $eventBus.realtimeViewMetaEventBus.off(evtListener)
  })

  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate, insertSort, canSyncSort }
}
