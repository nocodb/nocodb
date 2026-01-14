import { acceptHMRUpdate } from 'pinia'
import type { IntegrationsType, SyncConfig } from 'nocodb-sdk'
// import { ProjectSyncCreate, ProjectSyncProgressModal } from '#components'

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
  // State
  const baseSyncs = ref<Map<string, SyncConfig[]>>(new Map())
  const isLoadingSync = ref(false)
  const isSyncFeatureEnabled = ref(false)
  const isSyncAdvancedFeaturesEnabled = ref(false)

  // Getters
  const activeBaseSyncs = computed(() => [])

  // Actions
  const loadSyncs = async (_baseId: string, _force = false) => {
    return []
  }

  const readSync = async (_syncConfigId: string) => {
    return null
  }

  const createSync = async (_baseId: string, _data: any) => {
    return null
  }

  const updateSync = async (_id: string, _data: any) => {
    return null
  }

  const deleteSync = async (_baseId: string, _syncConfigId: string) => {
    return null
  }

  const triggerSync = async (_baseId: string, _syncConfigId: string, _bulk = false) => {
    return null
  }

  async function openNewSyncCreateModal(..._args: any[]) {}

  async function openSyncProgressModal(..._args: any[]) {}

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
    openNewSyncCreateModal,
    openSyncProgressModal,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSyncStore as any, import.meta.hot))
}
