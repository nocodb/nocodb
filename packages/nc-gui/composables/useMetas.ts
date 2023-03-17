import { message } from 'ant-design-vue'
import type { WatchStopHandle } from 'vue'
import type { TableType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, storeToRefs, useNuxtApp, useProject, useState, watch } from '#imports'

export function useMetas() {
  const { $api } = useNuxtApp()

  const { tables } = storeToRefs(useProject())

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
  const getMeta = async (tableIdOrTitle: string, force = false): Promise<TableType | null> => {
    if (!tableIdOrTitle) return null
    /** wait until loading is finished if requesting same meta */
    if (!force && loadingState.value[tableIdOrTitle]) {
      await new Promise((resolve) => {
        let unwatch: WatchStopHandle

        // set maximum 20sec timeout to wait loading meta
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

    loadingState.value[tableIdOrTitle] = true

    try {
      if (!force && metas.value[tableIdOrTitle]) {
        return metas.value[tableIdOrTitle]
      }

      const modelId = tableIdOrTitle.startsWith('md_') ? tableIdOrTitle : tables.value.find((t) => t.title === tableIdOrTitle)?.id

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
