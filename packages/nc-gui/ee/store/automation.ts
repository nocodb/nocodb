import type { ScriptType } from 'nocodb-sdk'

export const useAutomationStore = defineStore('automation', () => {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const bases = useBases()
  const { openedProject } = storeToRefs(bases)
  const workspaceStore = useWorkspace()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

  // State
  const automations = ref<Map<string, ScriptType[]>>(new Map())
  const activeAutomation = ref<ScriptType | null>(null)
  const isLoading = ref(false)
  const isLoadingAutomation = ref(false)

  const isSettingsOpen = ref(false)

  // Getters
  const isAutomationActive = computed(() => {
    return route.path.endsWith('automations/')
  })

  const activeBaseAutomations = computed(() => {
    if (!openedProject.value?.id) return []
    return automations.value.get(openedProject.value.id) || []
  })

  const activeAutomationId = computed(() => route.params.automationId as string)

  const activeBaseSchema = computedAsync(async () => {
    if (!openedProject.value?.id || !isAutomationEnabled.value) return null
    return await $api.base.schema(openedProject.value?.id)
  })

  // Actions
  const loadAutomations = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (!isAutomationEnabled.value) return []

    const existingAutomations = automations.value.get(baseId)
    if (existingAutomations && !force) {
      return existingAutomations
    }

    try {
      isLoading.value = true
      const response = await $api.script.list(baseId)
      automations.value.set(baseId, response)
      return response
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return []
    } finally {
      isLoading.value = false
    }
  }

  const loadAutomation = async (automationId: string, showLoader = true) => {
    if (!openedProject.value?.id || !automationId || !isAutomationEnabled.value) return null

    let automation: null | ScriptType = null

    if (automations.value.get(openedProject.value.id)?.find((a) => a.id === automationId)) {
      automation = (automations.value.get(openedProject.value.id) ?? []).find((a) => a.id === automationId) || null
    }

    try {
      if (showLoader) {
        isLoadingAutomation.value = true
      }

      automation = automation || ((await $api.script.get(openedProject.value.id, automationId, {})) as unknown as ScriptType)

      if (activeAutomationId.value) {
        activeAutomation.value = automation
      }

      return automation
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      if (showLoader) {
        isLoadingAutomation.value = false
      }
    }
  }

  const createAutomation = async (baseId: string, automationData: Partial<ScriptType>) => {
    try {
      isLoading.value = true
      const created = await $api.script.create(baseId, automationData)

      const baseAutomations = automations.value.get(baseId) || []
      baseAutomations.push(created)
      automations.value.set(baseId, baseAutomations)

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateAutomation = async (
    baseId: string,
    automationId: string,
    updates: Partial<ScriptType>,
    options?: {
      skipNetworkCall?: boolean
    },
  ) => {
    try {
      isLoading.value = true
      const automationn = automations.value.get(baseId)?.find((a) => a.id === automationId)
      const updated = options?.skipNetworkCall
        ? {
            ...automationn,
            ...updates,
          }
        : await $api.script.update(baseId, automationId, updates)

      const baseAutomations = automations.value.get(baseId) || []
      const index = baseAutomations.findIndex((a) => a.id === automationId)
      if (index !== -1) {
        baseAutomations[index] = updated as unknown as ScriptType
        automations.value.set(baseId, baseAutomations)
      }

      if (activeAutomation.value?.id === automationId) {
        activeAutomation.value = updated as unknown as ScriptType
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteAutomation = async (baseId: string, automationId: string) => {
    try {
      isLoading.value = true
      await $api.script.delete(baseId, automationId)

      // Update local state
      const baseAutomations = automations.value.get(baseId) || []
      const filtered = baseAutomations.filter((a) => a.id !== automationId)
      automations.value.set(baseId, filtered)

      if (activeAutomation.value?.id === automationId) {
        activeAutomation.value = null
      }

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return false
    } finally {
      isLoading.value = false
    }
  }

  const openScript = async (script: ScriptType) => {
    if (!script.base_id) return

    const basesS = bases.bases
    const workspaceId = workspaceStore.activeWorkspaceId

    let base = basesS.get(script.base_id)
    if (!base) {
      await bases.loadProject(script.base_id)
      base = basesS.get(script.base_id)
      if (!base) throw new Error('Base not found')
    }

    let workspaceIdOrType = workspaceId
    if (['nc', 'base'].includes(route.params.typeOrId as string)) {
      workspaceIdOrType = route.params.typeOrId as string
    }

    let baseIdOrBaseId = base.id
    if (['base'].includes(route.params.typeOrId as string)) {
      baseIdOrBaseId = route.params.baseId as string
    }

    ncNavigateTo({
      workspaceId: workspaceIdOrType,
      baseId: baseIdOrBaseId,
      automationId: script?.id,
      automation: true,
    })
  }

  watch(isAutomationActive, async (isActive) => {
    if (!openedProject.value?.id) return
    if (isActive) {
      await loadAutomations({ baseId: openedProject.value.id, force: true })
    }
  })

  // Watch for active automation changes
  watch(activeAutomationId, async (automationId) => {
    if (!openedProject.value?.id || !isAutomationEnabled.value) return
    if (automationId) {
      await loadAutomation(automationId)
    } else {
      activeAutomation.value = null
    }
  })

  return {
    // State
    automations,
    activeAutomation,
    isLoading,
    isLoadingAutomation,
    isSettingsOpen,
    activeBaseSchema,

    // Getters
    isAutomationActive,
    activeBaseAutomations,
    activeAutomationId,

    // Actions
    loadAutomations,
    loadAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    openScript,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutomationStore, import.meta.hot))
}
