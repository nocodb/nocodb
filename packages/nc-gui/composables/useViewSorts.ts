import type { SortType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  IsPublicInj,
  ReloadViewDataHookInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  storeToRefs,
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

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const reloadHook = inject(ReloadViewDataHookInj)

  const isPublic = inject(IsPublicInj, ref(false))

  const tabMeta = inject(TabMetaInj, ref({ sortsState: new Map() } as TabItem))

  const lastSorts = ref<SortType[]>([])

  watchOnce(sorts, (sorts: SortType[]) => {
    lastSorts.value = clone(sorts)
  })

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
      sorts.value = (await $api.dbTableSort.list(view.value!.id!)).list as SortType[]
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  // get delta between two objects and return the changed fields (value is from b)
  const getDelta = (a: any, b: any) => {
    return Object.entries(b)
      .filter(([key, val]) => a[key] !== val && key in a)
      .reduce((a, [key, v]) => ({ ...a, [key]: v }), {})
  }

  const saveOrUpdate = async (sort: SortType, i: number, undo = false) => {
    if (!undo) {
      const lastSort = lastSorts.value[i]
      if (lastSort) {
        const delta = clone(getDelta(sort, lastSort))
        if (Object.keys(delta).length > 0) {
          addUndo({
            undo: {
              fn: (prop: string, data: any) => {
                const f = sorts.value[i]
                if (f) {
                  f[prop] = data
                  saveOrUpdate(f, i, true)
                }
              },
              args: [Object.keys(delta)[0], Object.values(delta)[0]],
            },
            redo: {
              fn: (prop: string, data: any) => {
                const f = sorts.value[i]
                if (f) {
                  f[prop] = data
                  saveOrUpdate(f, i, true)
                }
              },
              args: [Object.keys(delta)[0], sort[Object.keys(delta)[0]]],
            },
            scope: defineViewScope({ view: view.value }),
          })
        }
      }
    }

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

    lastSorts.value = clone(sorts.value)
  }

  const deleteSort = async (sort: SortType, i: number, undo = false) => {
    try {
      if (isUIAllowed('sortSync') && sort.id && !isPublic.value && !isSharedBase.value) {
        await $api.dbTableSort.delete(sort.id)
      }
      sorts.value.splice(i, 1)
      sorts.value = [...sorts.value]

      if (!undo) {
        addUndo({
          redo: {
            fn: async () => {
              await deleteSort(sort, i, true)
            },
            args: [],
          },
          undo: {
            fn: () => {
              sorts.value.splice(i, 0, sort)
              saveOrUpdate(sort, i, true)
            },
            args: [clone(sort), i],
          },
          scope: defineViewScope({ view: view.value }),
        })
      }

      lastSorts.value = clone(sorts.value)

      tabMeta.value.sortsState!.set(view.value!.id!, sorts.value)

      reloadHook?.trigger()
      $e('a:sort:delete')
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const addSort = (undo = false) => {
    sorts.value = [
      ...sorts.value,
      {
        direction: 'asc',
      },
    ]

    $e('a:sort:add', { length: sorts?.value?.length })

    if (!undo) {
      addUndo({
        undo: {
          fn: async () => {
            await deleteSort(sorts.value[sorts.value.length - 1], sorts.value.length - 1, true)
          },
          args: [],
        },
        redo: {
          fn: () => {
            addSort(true)
          },
          args: [],
        },
        scope: defineViewScope({ view: view.value }),
      })
    }

    lastSorts.value = clone(sorts.value)

    tabMeta.value.sortsState!.set(view.value!.id!, sorts.value)
  }

  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate }
}
