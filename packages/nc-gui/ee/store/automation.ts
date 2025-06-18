import type { ScriptType } from 'nocodb-sdk'
import { DlgAutomationCreate } from '#components'
import { parseScript, validateConfigValues } from '~/components/smartsheet/automation/scripts/utils/configParser'

export const useAutomationStore = defineStore('automation', () => {
  const { $api, $e } = useNuxtApp()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const bases = useBases()
  const { activeProjectId } = storeToRefs(bases)
  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { isFeatureEnabled } = useBetaFeatureToggle()

  // State
  const automations = ref<Map<string, ScriptType[]>>(new Map())
  const isLoading = ref(false)
  const isLoadingAutomation = ref(false)
  const isSettingsOpen = ref(false)
  const isMarketVisible = ref(false)

  const activeBaseAutomations = computed(() => {
    if (!activeProjectId.value) return []
    return automations.value.get(activeProjectId.value) || []
  })

  const activeAutomationId = computed(() => route.params.automationId as string)

  const activeAutomation = computed(() => {
    if (!activeAutomationId.value) return null
    return activeBaseAutomations.value.find((a) => a.id === activeAutomationId.value) || null
  })

  const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

  const activeBaseSchema = computedAsync(async () => {
    if (!activeProjectId.value || !activeWorkspaceId.value || !isAutomationEnabled.value) return null
    return await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
      operation: 'baseSchema',
    })
  })

  // Actions
  const loadAutomations = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (!isAutomationEnabled.value) return []

    if (!activeWorkspaceId.value) return []

    const existingAutomations = automations.value.get(baseId)
    if (existingAutomations && !force) {
      return existingAutomations
    }

    try {
      isLoading.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'listScripts',
      })) as ScriptType[]

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
    if (!activeProjectId.value || !activeWorkspaceId.value || !automationId || !isAutomationEnabled.value) {
      return null
    }

    let automation: null | ScriptType = null

    if (automations.value.get(activeProjectId.value)?.find((a) => a.id === automationId)) {
      automation = (automations.value.get(activeProjectId.value) ?? []).find((a) => a.id === automationId) || null
    }

    try {
      if (showLoader) {
        isLoadingAutomation.value = true
      }

      automation =
        automation ||
        ((await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'getScript',
          id: automationId,
        })) as unknown as ScriptType)

      return automation
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
      })
      return null
    } finally {
      if (showLoader) {
        isLoadingAutomation.value = false
      }
    }
  }

  const duplicateAutomation = async (baseId: string, automationId: string) => {
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'duplicateScript',
        },
        {
          id: automationId,
        },
      )

      const baseAutomations = automations.value.get(baseId) || []
      baseAutomations.push(created)
      automations.value.set(baseId, baseAutomations)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: openedProject.value?.id,
        automationId: created.id,
      })

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const createAutomation = async (baseId: string, automationData: Partial<ScriptType>) => {
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'createScript',
        },
        automationData,
      )

      const baseAutomations = automations.value.get(baseId) || []
      baseAutomations.push(created)
      automations.value.set(baseId, baseAutomations)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        automationId: created.id,
      })

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
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      const automation = automations.value.get(baseId)?.find((a) => a.id === automationId)
      const updated = options?.skipNetworkCall
        ? {
            ...automation,
            ...updates,
          }
        : await $api.internal.postOperation(
            activeWorkspaceId.value,
            baseId,
            {
              operation: 'updateScript',
            },
            {
              ...updates,
              id: automationId,
            },
          )

      const baseAutomations = automations.value.get(baseId) || []
      const index = baseAutomations.findIndex((a) => a.id === automationId)
      if (index !== -1) {
        baseAutomations[index] = updated as unknown as ScriptType
        automations.value.set(baseId, baseAutomations)
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
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'deleteScript',
        },
        {
          id: automationId,
        },
      )

      // Update local state
      const baseAutomations = automations.value.get(baseId) || []
      const filtered = baseAutomations.filter((a) => a.id !== automationId)
      automations.value.set(baseId, filtered)

      if (activeAutomationId.value === automationId) {
        const nextAutomation = filtered[0]
        if (nextAutomation) {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId: activeProjectId.value,
            automationId: nextAutomation.id,
          })
        }
      }

      if (!filtered.length) {
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId: activeProjectId.value,
        })
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
    if (!script.base_id || !script.id) return

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
      automationId: script.id,
    })
  }

  // Watch for active automation changes
  watch(activeAutomationId, async (automationId) => {
    let automation
    if (!activeProjectId.value || !isAutomationEnabled.value) return
    if (automationId) {
      automation = await loadAutomation(automationId)
    }

    if (automation) {
      const script = parseScript(automation.script)
      const isValid = validateConfigValues(script ?? {}, automation.value?.config ?? {})
      if (isValid?.length) {
        isSettingsOpen.value = true
      } else {
        if (script) {
          isSettingsOpen.value = true
        }
        isSettingsOpen.value = false
      }
    }
  })

  // Script details modal

  const { availableScripts, getPluginDescription, getScriptContent, getPluginAssetUrl, pluginTypes, pluginDescriptionContent } =
    usePlugin()

  const isDetailsVisible = ref(false)
  const detailsScriptId = ref<string>()

  const showScriptDetails = (scriptId: string) => {
    detailsScriptId.value = scriptId
    isDetailsVisible.value = true

    $e('c:script:details', { scriptId })
  }

  async function openNewScriptModal({
    baseId,
    e,
    loadAutomationsOnClose,
    scrollOnCreate,
  }: {
    baseId?: string
    e?: string
    loadAutomationsOnClose?: boolean
    scrollOnCreate?: boolean
  }) {
    if (!baseId) return

    const isDlgOpen = ref(true)

    const { close } = useDialog(DlgAutomationCreate, {
      'modelValue': isDlgOpen,
      'baseId': baseId,
      'onUpdate:modelValue': () => closeDialog(),
      'onCreated': async (script: ScriptType) => {
        closeDialog()

        if (loadAutomationsOnClose) {
          await loadAutomations({ baseId, force: true })
        }

        $e(e ?? 'a:script:create')

        if (!script) return

        if (scrollOnCreate) {
          setTimeout(() => {
            const newScriptDom = document.querySelector(`[data-automation-id="${script.id}"]`)
            if (!newScriptDom) return

            // Scroll to the script node
            newScriptDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 1000)
        }
      },
    })

    function closeDialog() {
      isDlgOpen.value = false
      close(1000)
    }
  }

  return {
    // State
    automations,
    activeAutomation,
    isAutomationsLoading: isLoading,
    isLoadingAutomation,
    isSettingsOpen,
    activeBaseSchema,

    // Getters
    activeBaseAutomations,
    activeAutomationId,

    // Actions
    loadAutomations,
    loadAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    openScript,

    // Script Templates
    showScriptDetails,
    isDetailsVisible,
    detailsScriptId,
    isMarketVisible,
    availableScripts,
    getScriptDescription: getPluginDescription,
    descriptionContent: pluginDescriptionContent,
    getScriptContent,
    getScriptAssetsURL: (pathOrUrl: string) => getPluginAssetUrl(pathOrUrl, pluginTypes.script),
    openNewScriptModal,
    duplicateAutomation,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutomationStore, import.meta.hot))
}
