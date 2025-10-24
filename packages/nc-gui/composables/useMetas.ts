import type { WatchStopHandle } from 'vue'
import type { TableType } from 'nocodb-sdk'

export const useMetas = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { tables: _tables } = storeToRefs(useBase())

  const { activeProjectId } = storeToRefs(useBases())

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { baseTables } = storeToRefs(useTablesStore())

  // keep a temporary state of deleted tables to avoid get api calls
  const deletedTableIds = new Set<string>()

  // Helper function to create composite key: baseId:tableIdOrTitle
  const getMetaKey = (baseId: string, tableIdOrTitle: string) => `${baseId}:${tableIdOrTitle}`

  const metas = useState<{ [compositeKey: string]: TableType | any }>('metas', () => ({}))

  const metasWithIdAsKey = computed<Record<string, TableType>>(() => {
    const idEntries = Object.entries(metas.value)
      .filter(([k, v]) => {
        // Extract tableId from composite key (baseId:tableId) and compare with v.id
        const tableId = k.split(':')[1]
        return tableId === v.id
      })
      .map(([k, v]) => {
        // Return entry with just the tableId as key (without baseId prefix)
        // This maintains backward compatibility with code expecting tableId-only keys
        const tableId = k.split(':')[1]
        return [tableId, v]
      })
    return Object.fromEntries(idEntries)
  })

  // Helper function to get meta by baseId and tableId
  const getMetaByKey = (baseId: string | undefined, tableIdOrTitle: string | undefined): TableType | undefined => {
    if (!baseId || !tableIdOrTitle) return undefined
    return metas.value[getMetaKey(baseId, tableIdOrTitle)]
  }

  const loadingState = useState<Record<string, boolean>>('metas-loading-state', () => ({}))

  const setMeta = async (model: any) => {
    if (!model.base_id) return

    metas.value = {
      ...metas.value,
      [getMetaKey(model.base_id, model.id!)]: model,
      [getMetaKey(model.base_id, model.title)]: model,
    }
  }

  // todo: this needs a proper refactor, arbitrary waiting times are usually not a good idea
  const getMeta = async (
    baseId: string,
    tableIdOrTitle: string,
    force = false,
    skipIfCacheMiss = false,
    disableError = false,
    navigateOnNotFound = false,
  ): Promise<TableType | null> => {
    if (!baseId) {
      console.error('[getMeta] baseId is required but was not provided')
      return null
    }

    if (!tableIdOrTitle) return null

    const metaKey = getMetaKey(baseId, tableIdOrTitle)
    const loadingKey = metaKey

    // if already deleted return null
    if (deletedTableIds.has(tableIdOrTitle)) return null

    const tables = baseTables.value.get(baseId) ?? []

    /** wait until loading is finished if requesting same meta
     * use while to recheck loading state since it can be changed by other requests
     * */
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!force && loadingState.value[loadingKey]) {
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
          () => !!loadingState.value[loadingKey],
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

      if (metas.value[metaKey]) {
        return metas.value[metaKey]
      }
    }

    // return null if cache miss
    if (skipIfCacheMiss) return null

    loadingState.value[loadingKey] = true

    try {
      if (!force && metas.value[metaKey]) {
        return metas.value[metaKey]
      }
      const modelId =
        (tables.find((t) => t.id === tableIdOrTitle) || tables.find((t) => t.title === tableIdOrTitle))?.id || tableIdOrTitle

      const model = await $api.internal.getOperation(activeWorkspaceId.value!, baseId, {
        operation: 'tableGet',
        tableId: modelId,
      })

      // Ensure base_id is set on the model
      if (!model.base_id) {
        model.base_id = baseId
      }

      metas.value = {
        ...metas.value,
        [getMetaKey(baseId, model.id!)]: model,
        [getMetaKey(baseId, model.title)]: model,
      }

      return model
    } catch (e: any) {
      if (!disableError) {
        message.error(await extractSdkResponseErrorMsg(e))
      }

      if (navigateOnNotFound) {
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId: activeProjectId.value,
        })
      }
    } finally {
      delete loadingState.value[loadingKey]
    }
    return null
  }

  const clearAllMeta = () => {
    metas.value = {}
    deletedTableIds.clear()
  }

  const removeMeta = (baseId: string, idOrTitle: string, deleted = false) => {
    const metaKey = getMetaKey(baseId, idOrTitle)
    const meta = metas.value[metaKey]

    if (meta) {
      if (deleted) deletedTableIds.add(meta.id)
      delete metas.value[getMetaKey(baseId, meta.id)]
      delete metas.value[getMetaKey(baseId, meta.title)]
    }
  }

  // return partial metadata for related table of a meta service
  const getPartialMeta = async (baseId: string, linkColumnId: string, tableIdOrTitle: string): Promise<TableType | null> => {
    if (!tableIdOrTitle || !linkColumnId || deletedTableIds.has(tableIdOrTitle)) return null

    const metaKey = getMetaKey(baseId, tableIdOrTitle)
    const loadingKey = metaKey

    if (metas.value[metaKey]) {
      return metas.value[metaKey]
    }

    // wait until loading is finished if requesting same meta
    await until(() => !loadingState.value[loadingKey]).toBeTruthy({
      timeout: 5000,
    })

    try {
      loadingState.value[loadingKey] = true
      const model = await $api.dbLinks.tableRead(linkColumnId, tableIdOrTitle)

      // Ensure base_id is set on the model
      if (!model.base_id) {
        model.base_id = baseId
      }

      metas.value[getMetaKey(baseId, model.id!)] = model
      metas.value[getMetaKey(baseId, model.title)] = model
      return model
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      loadingState.value[loadingKey] = false
    }
  }
  return { getMeta, clearAllMeta, metas, metasWithIdAsKey, removeMeta, setMeta, getPartialMeta, getMetaByKey }
})
