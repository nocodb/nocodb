import type { ColumnType, SortType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { UndoRedoAction } from '~/lib/types'

export function useViewSorts(view: Ref<ViewType | undefined>, reloadData?: () => void) {
  const { sorts, eventBus } = useSmartsheetStoreOrThrow()

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { isSharedBase } = storeToRefs(useBase())

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const reloadHook = inject(ReloadViewDataHookInj)

  const isPublic = inject(IsPublicInj, ref(false))

  const lastSorts = ref<SortType[]>([])

  watchOnce(sorts, (sorts: SortType[]) => {
    lastSorts.value = clone(sorts)
  })

  const loadSorts = async () => {
    if (isPublic.value) {
      sorts.value = []
      return
    }

    try {
      if (!isUIAllowed('sortSync')) {
        return
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

      // Delete existing sort and not update the state as sort count in UI will change for a sec
      if (existingSort) {
        await $api.dbTableSort.delete(existingSort.id!)
        $e('a:sort:delete')
      }

      const data: any = await $api.dbTableSort.create(view.value?.id as string, {
        fk_column_id: column!.id,
        direction,
        push_to_top: true,
      })

      sorts.value = [...sorts.value.filter((_, index) => index !== existingSortIndex), data as SortType]

      addUndo({
        redo: {
          fn: async function redo(this: UndoRedoAction) {
            const data: any = await $api.dbTableSort.create(view.value?.id as string, {
              fk_column_id: column!.id,
              direction,
              push_to_top: true,
            })
            this.undo.args = [data.id]
            eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
            reloadDataHook?.trigger()
          },
          args: [],
        },
        undo: {
          fn: async function undo(id: string) {
            await $api.dbTableSort.delete(id)
            eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
            reloadDataHook?.trigger()
          },
          args: [data.id],
        },
        scope: defineViewScope({ view: view.value }),
      })

      eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
      reloadDataHook?.trigger()
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function deleteSort(sort: SortType, i: number, undo = false) {
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

      reloadHook?.trigger()
      $e('a:sort:delete')
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const addSort = (undo = false, column?: ColumnType) => {
    sorts.value = [
      ...sorts.value,
      {
        fk_column_id: column?.id,
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
  }

  return { sorts, loadSorts, addSort, deleteSort, saveOrUpdate, insertSort }
}
