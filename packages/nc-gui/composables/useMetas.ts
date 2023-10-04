import { message } from 'ant-design-vue'
import type { WatchStopHandle } from 'vue'
import type { TableType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, storeToRefs, useBase, useNuxtApp, useState, watch } from '#imports'

export function useMetas() {
  const { $api } = useNuxtApp()

  const { tables: _tables } = storeToRefs(useBase())
  const { baseTables } = storeToRefs(useTablesStore())

  const metas = useState<{ [idOrTitle: string]: TableType | any }>('metas', () => ({}))

  const metasWithIdAsKey = computed<Record<string, TableType>>(() => {
    const idEntries = Object.entries(metas.value).filter(([k, v]) => k === v.id)
    return Object.fromEntries(idEntries)
  })

  const loadingState = useState<Record<string, boolean>>('metas-loading-state', () => ({}))

  const setMeta = async (model: any) => {
    metas.value = {
      ...metas.value,
      [model.id!]: model,
      [model.title]: model,
    }
  }

  // todo: this needs a proper refactor, arbitrary waiting times are usually not a good idea
  const getMeta = async (
    tableIdOrTitle: string,
    force = false,
    skipIfCacheMiss = false,
    baseId?: string,
  ): Promise<TableType | null> => {
    if (!tableIdOrTitle) return null

    const tables = (baseId ? baseTables.value.get(baseId) : _tables.value) ?? []

    /** wait until loading is finished if requesting same meta
     * use while to recheck loading state since it can be changed by other requests
     * */
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!force && loadingState.value[tableIdOrTitle]) {
      await new Promise((resolve) => {
        let unwatch: WatchStopHandle

        // set maximum 10sec timeout to wait loading meta
        const timeout = setTimeout(() => {
          unwatch?.()
          clearTimeout(timeout)
          resolve(null)
        }, 10000)

        // watch for loading state change
        unwatch = watch(
          () => !!loadingState.value[tableIdOrTitle],
          (isLoading) => {
            if (!isLoading) {
              clearTimeout(timeout)
              unwatch?.()
              resolve(null)
            }
          },
          { immediate: true },
        )
      })

      if (metas.value[tableIdOrTitle]) {
        return metas.value[tableIdOrTitle]
      }
    }

    // return null if cache miss
    if (skipIfCacheMiss) return null

    loadingState.value[tableIdOrTitle] = true

    try {
      if (!force && metas.value[tableIdOrTitle]) {
        return metas.value[tableIdOrTitle]
      }

      const modelId = (tables.find((t) => t.id === tableIdOrTitle) || tables.find((t) => t.title === tableIdOrTitle))?.id

      if (!modelId) {
        console.warn(`Table '${tableIdOrTitle}' is not found in the table list`)
        return null
      }

      const model = await $api.dbTable.read(modelId)
      metas.value = {
        ...metas.value,
        [model.id!]: model,
        [model.title]: model,
      }

      return model
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      delete loadingState.value[tableIdOrTitle]
    }
    return null
  }

  const clearAllMeta = () => {
    metas.value = {}
  }

  const removeMeta = (idOrTitle: string) => {
    const meta = metas.value[idOrTitle]

    if (meta) {
      delete metas.value[meta.id]
      delete metas.value[meta.title]
    }
  }

  return { getMeta, clearAllMeta, metas, metasWithIdAsKey, removeMeta, setMeta }
}
