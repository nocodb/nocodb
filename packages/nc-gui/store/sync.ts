import { acceptHMRUpdate } from 'pinia'
import type { IntegrationsType, SyncConfig } from 'nocodb-sdk'

export interface SyncIntegrationConfig {
  id?: string
  title?: string
  type: IntegrationsType.Sync
  sub_type: string | null
  config: Record<string, any>
  syncConfigId?: string
  parentSyncConfigId?: string
}

export const useSyncStore = defineStore('sync', () => {
  const { $api } = useNuxtApp()

  const bases = useBases()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const { loadIntegrations } = useIntegrationStore()

  const isSyncFeatureEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.SYNC))

  const isSyncAdvancedFeaturesEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.SYNC_BETA_FEATURE))

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeProjectId } = storeToRefs(bases)

  // State
  const baseSyncs = ref<Map<string, SyncConfig[]>>(new Map())

  const isLoadingSync = ref(false)

  const activeBaseSyncs = computed(() => {
    if (!activeProjectId.value) return []
    return baseSyncs.value.get(activeProjectId.value) || []
  })

  // Actions
  const loadSyncs = async (baseId: string, force = false) => {
    if (!activeWorkspaceId.value) return []

    const existingSyncs = baseSyncs.value.get(baseId)
    if (existingSyncs && !force) {
      return existingSyncs
    }

    try {
      isLoadingSync.value = true

      const syncList = await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'listSync',
      })

      if (syncList && Array.isArray(syncList)) {
        baseSyncs.value.set(baseId, syncList)
      }

      return syncList
    } catch (error) {
      console.error('Error loading syncs:', error)
      message.error(await extractSdkResponseErrorMsgv2(error as any))
    } finally {
      isLoadingSync.value = false
    }
  }

  const readSync = async (syncConfigId: string) => {
    if (!activeProjectId.value || !activeWorkspaceId.value || !syncConfigId) {
      return null
    }

    let syncConfig: null | SyncConfig = null

    if (baseSyncs.value.get(activeProjectId.value)?.find((sync) => sync.id === syncConfigId)) {
      syncConfig = baseSyncs.value.get(activeProjectId.value)?.find((sync) => sync.id === syncConfigId) || null
    }

    try {
      syncConfig =
        syncConfig ||
        (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'readSync',
          id: syncConfigId,
        }))

      return syncConfig as SyncConfig
    } catch (error) {
      console.error('Error reading sync:', error)
      message.error(await extractSdkResponseErrorMsgv2(error as any))
      return null
    } finally {
      isLoadingSync.value = false
    }
  }

  const createSync = async (
    baseId: string,
    data: Partial<SyncConfig> & {
      configs: Array<Partial<IntegrationConfig>>
    },
  ) => {
    if (!activeWorkspaceId.value || !baseId) return null

    try {
      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'createSync',
        },
        data,
      )

      const curentBaseSyncs = baseSyncs.value.get(baseId) || []
      curentBaseSyncs.push(created?.syncConfig)
      baseSyncs.value.set(baseId, curentBaseSyncs)

      await loadIntegrations()

      return created as { job: { id: string } }
    } catch (error) {
      console.error('Error creating sync:', error)
      message.error(await extractSdkResponseErrorMsgv2(error as any))
      throw error
    }
  }

  const updateSync = async (
    id: string,
    data: Partial<SyncConfig> & {
      exclude_models?: string[]
      config?: SyncIntegrationConfig[]
    },
  ) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return null

    try {
      const result = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'updateSync',
        },
        data,
      )

      await loadIntegrations()

      if (result.syncConfig && result.syncConfig.id) {
        const curentBaseSyncs = baseSyncs.value.get(activeProjectId.value) || []
        const index = curentBaseSyncs.findIndex((sync) => sync.id === id)
        if (index !== -1) {
          curentBaseSyncs[index] = result.syncConfig
          baseSyncs.value.set(activeProjectId.value, curentBaseSyncs)
        }
      }

      return result
    } catch (error) {
      console.error('Error updating sync:', error)
      message.error(await extractSdkResponseErrorMsgv2(error as any))
      return null
    }
  }

  const deleteSync = async (baseId: string, syncConfigId: string) => {
    if (!activeWorkspaceId.value || !baseId) return null

    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'deleteSync',
        },
        {
          id: syncConfigId,
        },
      )

      const curentBaseSyncs = baseSyncs.value.get(baseId) || []
      const index = curentBaseSyncs.findIndex((sync) => sync.id === syncConfigId)
      if (index !== -1) {
        curentBaseSyncs.splice(index, 1)
        baseSyncs.value.set(baseId, curentBaseSyncs)
      }
      return true
    } catch (error) {
      console.error('Error deleting sync:', error)
      message.error(await extractSdkResponseErrorMsgv2(error as any))
      return false
    }
  }

  const triggerSync = async (baseId: string, syncConfigId: string, bulk = false) => {
    if (!activeWorkspaceId.value || !baseId) return null

    try {
      const syncData = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'triggerSync',
        },
        {
          id: syncConfigId,
          bulk,
        },
      )

      return syncData as { id: string }
    } catch (error) {
      console.error('Error triggering sync:', error)
      message.error(await extractSdkResponseErrorMsgv2(error as any))
    }
  }

  return {
    // State
    baseSyncs,
    isLoadingSync,
    isSyncAdvancedFeaturesEnabled,
    isSyncFeatureEnabled,

    // Getters
    activeBaseSyncs,

    // Actions
    loadSyncs,
    readSync,
    createSync,
    updateSync,
    deleteSync,
    triggerSync,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSyncStore as any, import.meta.hot))
}
