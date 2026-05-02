import type { WatchStopHandle } from 'vue'
import type { TableType } from 'nocodb-sdk'

export const useMetas = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { tables: _tables } = storeToRefs(useBase())

  const { activeProjectId } = storeToRefs(useBases())

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { baseTables } = storeToRefs(useTablesStore())

  // keep a temporary state of deleted tables per base to avoid get api calls
  const deletedTableIdsByBase = new Map<string, Set<string>>()

  const getDeletedTableIds = (baseId: string): Set<string> => {
    let set = deletedTableIdsByBase.get(baseId)
    if (!set) {
      set = new Set<string>()
      deletedTableIdsByBase.set(baseId, set)
    }
    return set
  }

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

    // Clean up stale title key when table is renamed
    const idKey = getMetaKey(model.base_id, model.id!)
    const existingMeta = metas.value[idKey]

    const updated = {
      ...metas.value,
      [idKey]: model,
      [getMetaKey(model.base_id, model.title)]: model,
    }

    if (existingMeta && existingMeta.title !== model.title) {
      delete updated[getMetaKey(model.base_id, existingMeta.title)]
    }

    metas.value = updated
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

    const tables = baseTables.value.get(baseId) ?? []

    // if marked as deleted, verify it's actually still gone
    // (e.g., table restored from trash re-appears in baseTables)
    const deletedSet = deletedTableIdsByBase.get(baseId)
    if (deletedSet?.has(tableIdOrTitle)) {
      if (tables.some((t) => t.id === tableIdOrTitle)) {
        deletedSet.delete(tableIdOrTitle)
      } else {
        return null
      }
    }

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
    deletedTableIdsByBase.clear()
  }

  /** Clear cached meta for a single base and reset deleted-table tracking. */
  const clearBaseMeta = (baseId: string) => {
    deletedTableIdsByBase.delete(baseId)
    for (const key of Object.keys(metas.value)) {
      if (key.startsWith(`${baseId}:`)) {
        delete metas.value[key]
      }
    }
  }

  const removeMeta = (baseId: string, idOrTitle: string, deleted = false) => {
    const metaKey = getMetaKey(baseId, idOrTitle)
    const meta = metas.value[metaKey]

    if (meta) {
      if (deleted) getDeletedTableIds(baseId).add(meta.id)
      delete metas.value[getMetaKey(baseId, meta.id)]
      delete metas.value[getMetaKey(baseId, meta.title)]
    }
  }

  const clearDeletedTableId = (baseId: string, tableId: string) => {
    deletedTableIdsByBase.get(baseId)?.delete(tableId)
  }

  // return partial metadata for related table of a meta service
  const getPartialMeta = async (baseId: string, linkColumnId: string, tableIdOrTitle: string): Promise<TableType | null> => {
    if (!tableIdOrTitle || !linkColumnId) return null

    const deletedSet = deletedTableIdsByBase.get(baseId)
    if (deletedSet?.has(tableIdOrTitle)) {
      const tables = baseTables.value.get(baseId) ?? []
      if (tables.some((t) => t.id === tableIdOrTitle)) {
        deletedSet.delete(tableIdOrTitle)
      } else {
        return null
      }
    }

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
      model.title = 'Private Table'

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

  return {
    getMeta,
    clearAllMeta,
    clearBaseMeta,
    metas,
    metasWithIdAsKey,
    removeMeta,
    clearDeletedTableId,
    setMeta,
    getPartialMeta,
    getMetaByKey,
  }
})
