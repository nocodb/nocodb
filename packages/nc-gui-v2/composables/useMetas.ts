import type { WatchStopHandle } from 'vue'
import type { TableInfoType, TableType } from 'nocodb-sdk'
import { useProject } from './useProject'
import { useNuxtApp, useState } from '#app'

export function useMetas() {
  const { $api } = useNuxtApp()
  const { tables } = useProject()

  const metas = useState<{ [idOrTitle: string]: TableType | any }>('metas', () => ({}))
  const loadingState = useState<Record<string, boolean>>('metas-loading-state', () => ({}))

  const getMeta = async (tableIdOrTitle: string, force = false): Promise<TableType | TableInfoType | null> => {
    if (!force && metas.value[tableIdOrTitle]) return metas.value[tableIdOrTitle]

    const modelId = (tables.value.find((t) => t.title === tableIdOrTitle || t.id === tableIdOrTitle) || {}).id

    if (!modelId) {
      console.warn(`Table '${tableIdOrTitle}' is not found in the table list`)
      return null
    }

    /** wait until loading is finished if requesting same meta */
    if (!force) {
      await new Promise((resolve) => {
        let unwatch: WatchStopHandle

        const timeout = setTimeout(() => {
          unwatch?.()
          clearTimeout(timeout)
          resolve(null)
        }, 20000)

        unwatch = watch(
          () => loadingState.value[modelId],
          (isLoading) => {
            if (!isLoading) {
              clearTimeout(timeout)
              resolve(null)
              unwatch?.()
            }
          },
          { immediate: true },
        )
      })
      if (metas.value[modelId]) return metas.value[modelId]
    }

    loadingState.value[modelId] = true

    const model = await $api.dbTable.read(modelId)
    metas.value = {
      ...metas.value,
      [model.id!]: model,
      [model.title]: model,
    }

    loadingState.value[modelId] = false

    return model
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

  return { getMeta, clearAllMeta, metas, removeMeta }
}
